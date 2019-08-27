const event = require('./actions');
const metadata = require('probot-metadata');
const configPath = "merge-guard-bot-config.yml";
const APPROVED_USER_KEY = "approved_users";

const defaultConfig = {
  active_team_member: "vilias,sssandyad,ajpahlevi,afrizal7",
  create_status_check_merge_based_on_label: {
    do_not_merge_labels: "pending merge,fix me,waiting core merged,waiting API release",
    allow_merge_labels: null
  },
  auto_update_merge_list_in_description: {
    identifier_label: "incremental",
    section_labels: "feature,enhancement,chore,bug,bug-testing,feedback"
  },
  when_user_review_pull_request: {
    keyword: null,
    add_labels: null,
    remove_labels: null,
    assign_user: false,
    unassign_user: false
  },
  when_user_approve_pull_request: {
    add_labels: null,
    remove_labels: null,
    assign_user: true,
    unassign_user: false
  },
  when_open_pull_request: {
    add_labels: null,
    add_assignees: null,
    add_review_requests: "vilias,sssandyad,ajpahlevi,afrizal7"
  },
  when_all_active_team_members_approved: {
    add_labels: "approved",
    remove_labels: "review me,fix me",
    add_assignees: null,
    remove_assignees: null,
    add_review_requests: null,
    remove_review_requests: null
  }
};

// const defaultConfig = {
//   active_team_member: null,
//   create_status_check_merge_based_on_label: {
//     do_not_merge_labels: "pending merge",
//     allow_merge_labels: null
//   },
//   auto_update_merge_list_in_description: {
//     identifier_label: null,
//     section_labels: null
//   },
//   when_user_review_pull_request: {
//     keyword: null,
//     add_labels: null,
//     remove_labels: null,
//     assign_user: false,
//     unassign_user: false
//   },
//   when_user_approve_pull_request: {
//     add_labels: null,
//     remove_labels: null,
//     assign_user: false,
//     unassign_user: false
//   },
//   when_open_pull_request: {
//     add_labels: null,
//     add_assignees: null,
//     add_review_requests: null
//   },
//   when_all_active_team_members_approved: {
//     add_labels: null,
//     remove_labels: null,
//     add_assignees: null,
//     remove_assignees: null,
//     add_review_requests: null,
//     remove_review_requests: null
//   }
// };

function isTwoArrayIdentical(arr1, arr2) {
  return arr1.length === arr2.length && arr1.sort().every(function(value, index) { 
      return value === arr2.sort()[index]
  });
}

function addLabels(config, context) {
  if (config == null) { return; }
  if (config.add_labels == null || config.add_labels == '') { return; }
  const addLabels = config.add_labels.split(',');
  context.github.issues.addLabels(
    context.issue({
      labels: addLabels
    })
  );
}

function removeLabels(config, context) {
  if (config == null) { return; }
  if (config.remove_labels == null || config.remove_labels == '') { return; }
  const removeLabels = config.remove_labels.split(',');
  var i = 0;
  for (i = 0; i < removeLabels.length; i++) {
    context.github.issues.removeLabel(
      context.issue({
        name: removeLabels[i]
      })
    );
  }
}

function addAssignees(config, context) {
  if (config == null) { return; }
  if (config.add_assignees == null || config.add_assignees == '') { return; }
  const addAssignees = config.add_assignees.split(',');
  context.github.issues.addAssignees(
    context.issue({
      assignees: addAssignees
    })
  );
}

function removeAssignees(config, context) {
  if (config == null) { return; }
  if (config.remove_assignees == null || config.remove_assignees == '') { return; }
  const removeAssignees = config.remove_assignees.split(',');
  context.github.issues.removeAssignees(
    context.issue({
      assignees: removeAssignees
    })
  );
}

function assignUser(config, context) {
  if (config == null) { return; }
  if (config.assign_user == null || !config.assign_user) { return; }
  const userLogin = context.payload.review.user.login;
  context.github.issues.addAssignees(
    context.issue({
      assignees: [userLogin]
    })
  );
}

function unassignUser(config, context) {
  if (config == null) { return; }
  if (config.unassign_user == null || !config.unassign_user) { return; }
  const userLogin = context.payload.review.user.login;
  context.github.issues.removeAssignees(
    context.issue({
      assignees: [userLogin]
    })
  );
}

function addReviewRequests(config, context) {
  if (config == null) { return; }
  if (config.add_review_requests == null || config.add_review_requests == '') { return; }
  const userLogin = context.payload.pull_request.user.login;
  const addReviewRequests = config.add_review_requests.split(',');
  const reviewers = addReviewRequests.filter(user => user != userLogin);
  context.github.pullRequests.createReviewRequest(
    context.issue({
      reviewers: reviewers
    })
  );
}

function removeReviewRequests(config, context) {
  if (config == null) { return; }
  if (config.remove_review_requests == null || config.remove_review_requests == '') { return; }
  const removeReviewRequests = config.remove_review_requests.split(',');
  context.github.pullRequests.deleteReviewRequest(
    context.issue({
      reviewers: removeReviewRequests
    })
  );
}

//all webhook request will call this function
function handleRequestLabels(robot, context) {
  
  //create_status_check_merge_based_on_label
  robot.on(['pull_request.labeled', 'pull_request.unlabeled', 'pull_request.synchronize', 'pull_request.opened', 'pull_request.reopened'], async context => {
    console.log("haha");
    const config = await context.config(configPath, defaultConfig);
    if (config.create_status_check_merge_based_on_label == null) { return; }
    const dontMergeLabelString = config.create_status_check_merge_based_on_label.do_not_merge_labels;
    if (dontMergeLabelString == null || dontMergeLabelString == '') { return; }
        
    const dontMergeLabels = dontMergeLabelString.split(',');
    const { labels, head } = context.payload.pull_request;
    const hasDontMergeLabel = labels.some(label => dontMergeLabels.includes(label.name));
    
    const allowMergeLabelString = config.create_status_check_merge_based_on_label.allow_merge_labels;
    
    //must refactor this hacky conditional code!
    if (context.payload.pull_request.head.repo.name == 'kaskus-forum-ios' || (allowMergeLabelString != null && allowMergeLabelString != '')) { 
      console.log("papa");
      //const allowMergeLabels = allowMergeLabelString.split(',');
      const allowMergeLabels = ['approved'];
      const hasAllowMergeLabel = labels.some(label => allowMergeLabels.includes(label.name));
      
      const state = hasDontMergeLabel ? 'failure' : hasAllowMergeLabel ? 'success' : 'pending';
      const description = hasDontMergeLabel ? 'Do not merge!' : hasAllowMergeLabel ? 'Ready for merge' : 'Wait until all members approved';
      
      context.github.repos.createStatus(
        context.repo({
          state,
          description,
          sha: head.sha,
          target_url: process.env.APP_LINK,
          context: process.env.APP_NAME
        })
      );
      
    } else {
      
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
    }
  });
  
  //handle set reviewers when open PR
  robot.on(['pull_request.opened'], async context => {
    const config = await context.config(configPath, defaultConfig);
    addLabels(config.when_open_pull_request, context);
    addAssignees(config.when_open_pull_request, context);
    addReviewRequests(config.when_open_pull_request, context);
  });
  
  robot.on(['pull_request_review.submitted', 'pull_request_review.dismissed'], async context => {
    const config = await context.config(configPath, defaultConfig);
    const approvedUsersMetadata = await metadata(context).get(APPROVED_USER_KEY);
    const userApprove = context.payload.review.user.login;
    const userPullRequest = context.payload.pull_request.user.login;
    var approvedUsers = approvedUsersMetadata == null ? [] : approvedUsersMetadata;
    approvedUsers = approvedUsers.filter(user => user != userPullRequest);
    
    const state = context.payload.review.state;
    
    //handle when user approve
    if (state == 'approved') {
      assignUser(config.when_user_approve_pull_request, context);
      unassignUser(config.when_user_approve_pull_request, context);
      
      approvedUsers.push(userApprove)
      approvedUsers = [...new Set(approvedUsers)];
    }
    
    //handle when user review
    var canHandleUserReview = config.when_user_review_pull_request != null 
      && (config.when_user_review_pull_request.keyword == null || (config.when_user_review_pull_request.keyword == '' && context.payload.review.body.includes(config.when_user_review_pull_request.keyword)));
    if (canHandleUserReview) {
      addLabels(config.when_user_review_pull_request, context);
      removeLabels(config.when_user_review_pull_request, context);
      assignUser(config.when_user_review_pull_request, context);
      unassignUser(config.when_user_review_pull_request, context);
    }
    
    await metadata(context).set(APPROVED_USER_KEY, approvedUsers);
    
    //handle when all members approved
    const teamMembers = config.active_team_member;
    if (teamMembers == null || teamMembers == '') { return; }
    const filteredTeamMembers = teamMembers.split(',').filter(user => user != userPullRequest);
    const isAllMembersApproved = isTwoArrayIdentical(filteredTeamMembers, approvedUsers);
    if (isAllMembersApproved) {
      addLabels(config.when_all_active_team_members_approved, context);
      removeLabels(config.when_all_active_team_members_approved, context);
      addAssignees(config.when_all_active_team_members_approved, context);
      removeAssignees(config.when_all_active_team_members_approved, context);
      addReviewRequests(config.when_all_active_team_members_approved, context);
      removeReviewRequests(config.when_all_active_team_members_approved, context);
    }
    
  });
  
  //update body when merged to incremental
  robot.on(['pull_request.closed'], async context => {
    const pr = context.payload.pull_request;
    if (pr.merged) {
      
      const config = await context.config(configPath, defaultConfig);
      if (config.auto_update_merge_list_in_description == null) { return; }
      const indentifierLabel = config.auto_update_merge_list_in_description.identifier_label
      if (indentifierLabel == null || indentifierLabel == '') { return; }
      const sectionLabels = config.auto_update_merge_list_in_description.section_labels
      const identifiers = indentifierLabel.split(',');
      
      const baseRef = pr.base.ref;
      const allPRs = await context.github.pullRequests.list(context.repo());
      const basePR = allPRs.data.find(pull => {
        return pull.head.ref === baseRef;
      });
      
      const isAutoUpdate = basePR.labels.some(label => identifiers.includes(label.name));
      if (isAutoUpdate) {
        var labelIndex = {};
        const sections = sectionLabels == null ? [] : sectionLabels.split(',');
        var i = 0;
        for (i; i < sections.length; i++) {
          labelIndex[sections[i]] = i + 1;
        }
        
        var templateBody = ['-----**MERGED LIST**-----'];
        for (i=0; i < sections.length; i++) {
          templateBody.push('**' + sections[i].toUpperCase() + ' (0)**');
        }
        
        var label = [Object.keys(labelIndex), pr.labels.map(label => label.name)].reduce((a, c) => a.filter(i => c.includes(i)));

        var bodyArr = basePR.body.split('\r\n\r\n');
        if (bodyArr == undefined || bodyArr.length == 0 || bodyArr[0] != '-----**MERGED LIST**-----') {
          bodyArr = templateBody.slice()
        } else {
          if (bodyArr[bodyArr.length - 1].includes('_unlabeled_')) {
            templateBody.push('**_unlabeled_ (0)**');
          }
        }
        
        if (label.length > 0) {
          for(i=0; i<label.length; i++) {
            bodyArr[labelIndex[label[i]]] += '\r\n' + pr.title + ' #' + pr.number;
          }
        } else {
          if (!bodyArr[bodyArr.length - 1].includes('_unlabeled_')) {
            bodyArr.push('**_unlabeled_ (0)**');
          }
          templateBody.push('**_unlabeled_ (0)**');
          bodyArr[bodyArr.length - 1] += '\r\n' + pr.title + ' #' + pr.number;
        }
        
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
