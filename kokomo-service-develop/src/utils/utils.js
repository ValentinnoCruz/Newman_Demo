const npmJson = require('../../package.json');
const logger = require('../../logger');
module.exports = {
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  responseJsonBuilder(message ={}) {
    const newMess = {...message, version: npmJson.version || '1.0.0'};
    logger.info('version: ', npmJson.version);
    return newMess;
  },
  async decryptSecrets() {
    const {
      SecretManagerServiceClient,
    } = require("@google-cloud/secret-manager");
    const parent = `projects/gcp-kokomo-dev`;
    const client = new SecretManagerServiceClient();

    const [secrets] = await client.listSecrets({
      parent: parent,
    });

    for (const secret of secrets) {
      const [version] = await client.accessSecretVersion({
        name: `${secret.name}/versions/latest`,
      });
      const payload = version.payload.data.toString("utf8").trim();
      const finalEnvName = secret.name.substring(
        secret.name.lastIndexOf("/") + 1
      );
      process.env[finalEnvName] = payload;
      console.info(`decrypting ${finalEnvName} and setting as ENV variable`);
    }
  }
}
