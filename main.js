import { Database } from "bun:sqlite"
import { mkdir } from "node:fs/promises";
import * as crypto from "node:crypto";
import * as zod from "zod"
import Argon from "./argon.js";

await mkdir("storage", { recursive: true });

const db = new Database("storage/database.sqlite");
db.exec(`
CREATE TABLE IF NOT EXISTS Players (
    AccountID       INTEGER PRIMARY KEY,
    ExtraIconData   TEXT NOT NULL,
    Token           TEXT NOT NULL
) WITHOUT ROWID
`);

process.on("uncaughtException", error => {
    console.warn(`${error.message}\n\t${error.stack}`);
});

process.on("unhandledRejection", error => {
    console.warn(`${error.message}\n\t${error.stack}`);
});

const TokenGETJSON = zod.object({
    accountID: zod.number().int(),
    token: zod.string() // argon token
});

const iconTypes = [ "cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing", "jetpack", "shared" ];
const modIDRegex = /^[a-z0-9_\-]+\.[a-z0-9_\-]+$/

const IconsGETJSON = zod.object({
    players: zod.record(
        zod.number().int(), zod.array(zod.enum(iconTypes))
    )
});

const IconsPOSTJSON = zod.object({
    accountID: zod.number().int(),
    token: zod.string(),
    data: zod.record(
        zod.enum(iconTypes), zod.record(
            zod.string().regex(modIDRegex), zod.any()
        )
    )
});

Bun.serve({
    routes: {
        "/": Response.redirect("https://undefined0.dev/cat"),

        // get random "token" page from wikipedia api
        "/token": async req => {
            let res = await fetch("https://en.wikipedia.org/w/api.php?action=opensearch&search=token");
            let json = await res.json();

            return Response.redirect(json[3][~~(Math.random() * json[3].length)]);
        },
        "/token/get": {
            "POST": async req => {
                // generate new token with argon token for account id
                let json = TokenGETJSON.parse(await req.json());
                
                let valid = await Argon.validate(json.accountID, json.token);
                if (!valid) {
                    throw new Error("Argon validation failed!");
                }

                let token = crypto.randomBytes(20).toString("hex");

                db.exec(`
                    INSERT OR REPLACE
                    INTO Players (AccountID, Token)
                    VALUES (?, ?)`,
                    json.accountID, token
                );

                return new Response(JSON.stringify({ success: true, token }));
            }
        },

        "/icons": Response.redirect("https://geode-sdk.org/mods/undefined0.icon_ninja"),
        "/icons/get": {
            "POST": async req => {
                let json = IconsGETJSON.parse(await req.json());

                let ret = {};

                for (let [player, iconTypes] of Object.entries(json.players)) {
                    let rows = db
                        .query(`SELECT ExtraIconData FROM Players WHERE AccountID = ?`)
                        .all(parseInt(player));
                    
                    let data = {};

                    if (rows.length == 0) {
                        // empty data
                        for (let type of iconTypes) { data[type] = {}; }
                        delete data.shared;
                    } else {
                        data = JSON.parse(rows[0].ExtraIconData);
                    }

                    ret[player] = {};
                    for (let type of iconTypes) {
                        ret[player][type] = {
                            ...data[type],
                            ...data.shared
                        };
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    ...ret
                }));
            },
        },
        "/icons/set": {
            "POST": async req => {
                let json = IconsPOSTJSON.parse(await req.json());

                // verify token
                let rows = db
                    .query(`SELECT Token FROM Players WHERE AccountID = ?`)
                    .all(json.accountID);

                if (rows.length == 0) {
                    // no token generated for user yet
                    throw new Error("No token generated for user yet!");
                }

                let token = rows[0].Token;
                if (token != json.token) {
                    throw new Error("Token mismatch!");
                }

                // and insert
                db.exec(`
                    INSERT OR REPLACE 
                    INTO Players (AccountID, ExtraIconData) 
                    VALUES (?, ?)`,
                    parseInt(json.accountID), JSON.stringify(json.data)
                );

                return new Response(JSON.stringify({ success: true }));
            }
        }
    },

    error: error => {
        console.warn(error);
        return new Response(JSON.stringify({ success: false, error }))
    },

    port: 2001
});

console.log("Server up!");
