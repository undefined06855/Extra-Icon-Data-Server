import { Database } from "bun:sqlite"
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import Argon from "./argon.js";

await mkdir("storage", { recursive: true });

const db = new Database("storage/database.sqlite");
db.exec(`DROP TABLE Players`)
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

Bun.serve({
    routes: {
        "/": Response.redirect("https://undefined0.dev/cat"),

        "/token": {
            "GET": async req => {
                // generate new token with argon token for account id
                let json = await req.json();

                // check required keys
                if (!"accountID" in json || !"token" in json) {
                    return new Response(`{"success": false}`);
                }
                
                let valid = await Argon.validate(json.accountID, json.token);

                if (!valid) {
                    return new Response(`{"success": false}`);
                }

                let token = randomBytes(20).toString("hex");

                db.exec(`
                    INSERT OR REPLACE
                    INTO Players (AccountID, Token)
                    VALUES (?, ?)`,
                    json.accountID, token
                );

                return new Response(`{"success": true, "token": "${token}"}`);

            },
            "POST": async req => {
                // verify token for account id
            }
        },

        "/icons": {
            "GET": async req => {
                let json = await req.json();

                // check required keys
                if (!"players" in json) {
                    return new Response(`{"success": false}`);
                }

                let ret = {};

                for (let [player, iconType] of Object.entries(json.players)) {
                    player = parseInt(player);

                    let rows = db
                        .query(`SELECT ExtraIconData FROM Players WHERE AccountID = ?`)
                        .all(player);
                    
                    if (rows.length == 0) {
                        ret[player] = {};
                        continue;
                    }

                    let data = JSON.parse(rows[0].ExtraIconData);
                    if (iconType == -1) {
                        ret[player] = data;
                        delete ret[player].shared
                        for (let iconType of Object.keys(data)) {
                            ret[player][iconType] = {
                                ...data[iconType],
                                ...data.shared
                            }
                        }
                    } else {
                        ret[player] = {
                            ...data[iconType],
                            ...data.shared
                        };
                    }
                }

                return new Response(JSON.stringify(ret));
            },

            "POST": async req => {
                let json = await req.json();

                // check required keys
                if (!"data" in json || !"accountID" in json || !"token" in json) {
                    return new Response(`{"success": false}`);
                }

                let requiredKeys = [
                    "cube", "ship", "ball", "ufo", "wave", "robot", "spider",
                    "swing", "jetpack", "shared"
                ]

                for (let key of requiredKeys) {
                    if (!key in json.data) {
                        return new Response(`{"success": false}`);
                    }

                    if (!typeof key === "object") {
                        return new Response(`{"success": false}`);
                    }
                }

                // verify token
                let rows = db
                    .query(`SELECT Token FROM Players WHERE AccountID = ?`)
                    .all(json.accountID);

                if (rows.length == 0) {
                    // no token generated for user yet
                    return new Response(`{"success": false}`);
                }

                let token = rows[0].Token;
                if (token != json.token) {
                    return new Response(`{"success": false}`);
                }

                // and insert
                db.exec(`
                    INSERT OR REPLACE 
                    INTO Players (AccountID, ExtraIconData) 
                    VALUES (?, ?)`,
                    parseInt(json.accountID), JSON.stringify(json.data)
                );

                return new Response(`{"success": true}`);
            }
        }
    },

    port: 2001
});

console.log("Server up!");
