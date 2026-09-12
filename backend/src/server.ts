import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSockets } from "./sockets";
import { startSlaCheckJob } from "./jobs/sla-check.job";
import { startAssetAlertsJob } from "./jobs/asset-alerts.job";
import { startHelpdeskDeadlineCheckJob } from "./jobs/helpdesk-deadline-check.job";

const app = createApp();
const server = http.createServer(app);

initSockets(server);
startSlaCheckJob();
startAssetAlertsJob();
startHelpdeskDeadlineCheckJob();

server.listen(env.port, () => {
  console.log(`Soliflex ticketing API listening on port ${env.port} [${env.nodeEnv}]`);
});
