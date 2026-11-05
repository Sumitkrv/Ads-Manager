import { createApp } from "./app.js";
import { config } from "./config.js";
const server = createApp().listen(config.API_PORT, config.API_HOST, () => {
    console.info("AI Ads Manager API listening at http://" + config.API_HOST + ":" + config.API_PORT);
});
server.on("error", (error) => {
    console.error("API startup failed: " + error.name);
    process.exitCode = 1;
});
function shutdown() {
    server.close((error) => {
        if (error) {
            console.error("API shutdown failed: " + error.name);
            process.exitCode = 1;
        }
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
