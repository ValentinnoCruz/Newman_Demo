const { spawn } = require("child_process");
const {getEnvAsync} = require("./config");
const {decryptSecrets} = require("./src/utils/utils");

const startCloudSQLProxy = async() => {

  await decryptSecrets();
  let connectionString = process.env.CLOUD_SQL_CONNECTION_STRING;
  console.info(`Got connection string ${connectionString}`);

  return new Promise(resolve => {
    const cloudProxy = spawn("./cloud_sql_proxy", [`-instances=${connectionString}=tcp:127.0.0.1:5432`, "-term_timeout=30s"]);
    console.info(`Starting cloud proxy`);
    cloudProxy.stdout.on("data", data => {
      console.log(`stdout: ${data}`);
    });

    cloudProxy.stderr.on("data", data => {
      console.log(`stderr: ${data}`);
      if(data.includes('Ready for new connections'))
      {
        console.log('resolving')
        resolve(cloudProxy);
      }
    });

    cloudProxy.on('error', (error) => {
      console.log(`error: ${error.message}`);

    });

    cloudProxy.on("close", code => {
      console.log(`child process exited with code ${code}`);
      process.exit(0);
    });

  })
}

startCloudSQLProxy().then((p) => {
  console.info('Cloud SQL proxy started');
  // process.on('SIGTERM', () => {
  //   console.info('SIGTERM signal received.');
  //   p.kill();
  //   process.exit(0)
  // });
})


