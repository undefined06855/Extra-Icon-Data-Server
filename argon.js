// GlobedGD/argon wrapper for node.js
// by undefined0
// feel free to use it really doesn't do much

export default Argon = {
    baseUrl: "https://argon.globed.dev/v1",

    /**
     * Validates an argon token.
     * @param {number} accountID The account id sent from the client
     * @param {string} token The token sent from the client
     * @returns {Promise<boolean>} Whether the token is valid for the account ID or not
     */
    async validate(accountID, token) {
        let res = await fetch(`${this.baseUrl}/validation/check?account_id=${accountID}&authtoken=${token}`);
        
        if (res.status != 200) {
            console.warn("[Argon] Error from server %s (%s)!", res.status, await res.text());
            return false;
        }
        
        let json = await res.json();
        
        if (!json.valid) {
            console.warn("[Argon] Invalid token supplied (%s)!", json.cause);
            return false;
        }

        return true;
    }
};
