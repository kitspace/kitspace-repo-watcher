const superagent = require('superagent');
const cp = require('child_process');

(async () => {
  console.log('watching...')
  while (1) {
    const deployedReq = await superagent.get(
      'http://kitspace.org/registry.json',
    );
    const registryReq = await superagent.get(
      'https://raw.githubusercontent.com/kitspace/kitspace/master/registry.json',
    );
    const registry = JSON.parse(registryReq.text);

    const boards = deployedReq.body.filter(
      x => !registry.find(r => r.repo === x.repo),
    );

    const remote = await Promise.all(
      boards.map(board => getVersion(board.repo)),
    );
    const changed = boards.filter((board, i) => {
      remoteVersion = remote[i];
      console.log('checking', board.repo);
      return remoteVersion !== board.hash;
    });
    if (changed.length > 0) {
      console.log({changed});
      await superagent
        .post('https://api.travis-ci.org/repo/kitspace%2Fkitspace/requests')
        .set({
          'Travis-API-Version': '3',
          Authorization: `token ${process.env.TRAVIS_API_KEY}`,
        })
        .send({
          request: {
            branch: 'master',
          },
        })
        .then(r => console.log(r.body));
	.catch(e => console.error(e))
      console.log('waiting 7 minutes...');
      await promiseTimeout(7 * 60000);
    }
    console.log('waiting 1 minute...');
    await promiseTimeout(60000);
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});

function promiseTimeout(t) {
  return new Promise(resolve => {
    setTimeout(resolve, t);
  });
}

function getVersion(repo) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(
      () => reject(Error(`timed out to get version for ${repo}`)),
      10000,
    );
    cp.exec(`git ls-remote ${repo}`, {encoding: 'utf8'}, (err, output) => {
      clearTimeout(id);
      const hash = output.split('\n')[0].split('\t')[0];
      if (!hash) {
        reject(Error(`could not get version for ${repo}`));
      }
      resolve(hash);
    });
  });
}
