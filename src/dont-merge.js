const event = require('./actions');
const utils = require('./utils');

function handleRequestLabels(robot, context) {
  robot.on(event.actions, async context => {

    robot.log(context);

    const { labels, head } = context.payload.pull_request;
    const hasDontMergeLabel = labels.some(label => utils.isDontMerge(label.name));
    const state = hasDontMergeLabel ? 'pending' : 'success';
    const description = hasDontMergeLabel ? 'Do not merge!' : 'Ready for merge';

    context.github.repos.createStatus(
      context.repo({
        state,
        description,
        sha: head.sha,
        target_url: process.env.APP_LINK,
        context: process.env.APP_NAME
      })
    );
  });

  // robot.on('pull_request.labeled', async context => {
  //   // An issue was just opened.
  //   //const params = context.issue({ body: 'Hello World!' });

  //   context.log("loh kok di close?");
  //   console.log("lalalalala");

  //   // Post a comment on the issue
  //   //return context.github.issues.createComment(params)
  // });

  // robot.on('issues.opened', async context => {
  //   // An issue was just opened.
  //   const params = context.issue({ body: 'Hello World!' });

  //   context.log(context);
  //   console.log("coba ah");

  //   // Post a comment on the issue
  //   return context.github.issues.createComment(params)
  // });

  //   robot.on('issues.closed', async context => {
  //   // An issue was just opened.
  //   //const params = context.issue({ body: 'Hello World!' });

  //   context.log("hehehehehehehe");
  //   console.log("closed ah");

  //   // Post a comment on the issue
  //   //return context.github.issues.createComment(params)
  // });

}

module.exports = handleRequestLabels;
