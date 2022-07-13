// No imports here, place in main() function

async function decryptSecrets() {
  const {
    SecretManagerServiceClient,
  } = require("@google-cloud/secret-manager");
  const parent = `projects/${process.env.GOOGLE_CLOUD_PROJECT}`;
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

async function main() {
  require("dotenv").config();

  const inGcp = String(process.env.IN_GCP).toLowerCase() === "true";
  console.info(`in GCP? ${inGcp}`);
  if (inGcp) {
    await decryptSecrets();
  }
  const server = require("./server");
  await server();
}

main()
  .then(async function () {
    // Put imports here so we first decrypt all secrets before doing anything else
    const { getDBInstance } = require("./src/utils/dbUtils");
    const { syncInstancesAndDB } = require("./src/utils/gCompute");
    const dbRelationships = require("./src/models/dbRelationships");
    const { ConfigDBModel, getValue } = require("./src/models/configDBModel");
    // Sync DB
    const sequelize = getDBInstance();
    await dbRelationships.init();
    await sequelize.sync();
    if (String(process.env.IN_GCP).toLowerCase() === "true") {
      await syncInstancesAndDB();
    }
    const accessTokenLife = await getValue("ACCESS_TOKEN_LIFE");
    if (!accessTokenLife) {
      await ConfigDBModel.create({ key: "ACCESS_TOKEN_LIFE", value: "3m" });
    }
  })
  .catch((err) => {

    console.error("Unexpected error", err);
    process.exit(1);
  });
