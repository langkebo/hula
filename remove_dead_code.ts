import { Project } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths("src/utils/ImRequestUtils.ts");
const sourceFile = project.getSourceFileOrThrow("src/utils/ImRequestUtils.ts");

const unusedFunctions = [
  'getNoticeUnreadCount',
  'getAnnouncementList',
  'getFriendPage',
  'getBadgesBatch',
  'groupListMember',
  'blockUser',
  'requestNoticePage',
  'requestNoticeRead',
  'getSessionDetail',
  'deleteSession',
  'groupList',
  'updateMyRoomInfo',
  'feedDetail',
  'feedList',
  'pushFeed',
  'delFeed',
  'editFeed',
  'getFeedPermission',
  'feedLikeToggle',
  'feedLikeList',
  'feedLikeCount',
  'feedLikeHasLiked',
  'feedCommentAdd',
  'feedCommentDelete',
  'feedCommentList',
  'feedCommentCount',
  'feedCommentAll',
  'imageGet',
  'videoGet',
  'audioMyPage',
  'audioGetMy',
  'audioDeleteMy'
];

for (const fn of unusedFunctions) {
  const func = sourceFile.getFunction(fn);
  if (func) {
    func.remove();
  }
}

sourceFile.saveSync();
console.log("Done!");
