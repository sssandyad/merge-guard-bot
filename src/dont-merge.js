const event = require('./actions');
const utils = require('./utils');
const metadata = require('probot-metadata');

function handleRequestLabels(robot, context) {
  
  //handle prevent merge based on PR labels. important so need to listent all event
  robot.on(['pull_request.labeled', 'pull_request.unlabeled', 'pull_request.synchronize', 'pull_request.opened', 'pull_request.reopened', 'pull_request.edited', 'pull_request.closed'], async context => {
    
    const { labels, head } = context.payload.pull_request;
    const hasDontMergeLabel = labels.some(label => utils.isDontMerge(label.name));
    const state = hasDontMergeLabel ? 'failure' : 'success';
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
  
  //handle set reviewers when open PR
  robot.on(['pull_request.opened'], async context => {
    const pullRequestOwner = context.payload.pull_request.user.login;
    const reviewers = process.env.TEAM_MEMBERS.split(',').filter(member => member != pullRequestOwner);

    context.github.pullRequests.createReviewRequest(
      context.issue({
        reviewers
      })
    );
  });
  
  //handle PR assignee after approving pull request
  robot.on(['pull_request_review.submitted', 'pull_request_review.dismissed'], async context => {
    const userReview = context.payload.review.user.login;
    const state = context.payload.review.state;
    
    if (state == 'approved') {
      context.github.issues.addAssignees(
        context.issue({
          assignees: [userReview]
        })
      );
    } else {
      context.github.issues.removeAssignees(
        context.issue({
          assignees: [userReview]
        })
      );
    }
  });
  
  //handle set labels when all member already approve
  robot.on(['pull_request.assigned', 'pull_request.unassigned'], async context => {
    const pullRequestOwner = context.payload.pull_request.user.login;
    const reviewers = process.env.TEAM_MEMBERS.split(',').filter(member => member != pullRequestOwner);
    const assignees = context.payload.pull_request.assignees.map(user => user.login);
    const isAllMembersApproved = reviewers.length === assignees.length && reviewers.sort().every(function(value, index) { 
      return value === assignees.sort()[index]});
    
    if (isAllMembersApproved) {
      context.github.issues.addLabels(
        context.issue({
          labels: ['approved']
        })
      );
      context.github.issues.removeLabel(
        context.issue({
          name: 'review me'
        })
      );
      context.github.issues.removeLabel(
        context.issue({
          name: 'fix me'
        })
      );
    } else {
      context.github.issues.removeLabel(
        context.issue({
          name: 'approved'
        })
      );
    }
    
  });
  
  //update body when merged to incremental
  robot.on(['pull_request.closed'], async context => {
    const pr = context.payload.pull_request;
    if (pr.merged) {
      const baseRef = pr.base.ref;
      const allPRs = await context.github.pullRequests.list(context.repo());
      const basePR = allPRs.data.find(pull => {
        return pull.head.ref === baseRef;
      });
      
      const isIncremental= basePR.labels.some(label => { return label.name == 'incremental'});
      if (isIncremental) {
        const labelIndex = {
          'feature': 1,
          'enhancement': 2,
          'chore': 3,
          'bug': 4,
          'bug-testing': 5,
          'feedback': 6
        };
        const templateBody = [
          '-----**MERGED LIST**-----',
          '**FEATURE (0)**',
          '**ENHANCEMENT (0)**',
          '**CHORES (0)**',
          '**BUG (0)**',
          '**BUG-TESTING (0)**',
          '**FEEDBACK (0)**'
        ];
        
        const label = [Object.keys(labelIndex), pr.labels.map(label => label.name)].reduce((a, c) => a.filter(i => c.includes(i)));
        var bodyArr = basePR.body.split('\r\n\r\n');
        if (bodyArr == undefined || bodyArr.length == 0 || bodyArr[0] != '-----**MERGED LIST**-----') {
          bodyArr = templateBody.slice()
        }
        bodyArr[labelIndex[label]] += '\r\n' + pr.title + ' #' + pr.number;
        
        var updateBody = templateBody[0];
        for (var i = 1; i < templateBody.length; i++) {
          var splittedBodyArr = bodyArr[i].split('\r\n').slice(1);
          updateBody += '\r\n\r\n' + templateBody[i].replace('0', splittedBodyArr.length);
          
          if (splittedBodyArr.length > 0) {
            updateBody += '\r\n' + splittedBodyArr.join('\r\n');
          }
        };
        
        context.github.pullRequests.update(
          context.repo({
            number: basePR.number,
            body: updateBody
          })
        );
      }
    }    
  });
}

module.exports = handleRequestLabels;
