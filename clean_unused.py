import re

DECL_RE = re.compile(r'^(export\s+)?(type|interface|enum|class)\s+([A-Za-z_][A-Za-z0-9_]*)\b')


def find_decl_end(lines, start_idx):
    """Find end line index (inclusive) of declaration starting at start_idx."""
    brace = 0
    found_brace = False
    for i in range(start_idx, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                brace += 1
                found_brace = True
            elif ch == '}':
                brace -= 1
        if found_brace and brace == 0:
            return i
    # No braces: single-line type alias
    return start_idx


def find_jsdoc_start(lines, decl_start):
    """Find start line of preceding JSDoc/block comment, else decl_start."""
    j = decl_start - 1
    if j < 0:
        return decl_start
    above = lines[j].strip()
    if above.endswith('*/') and (above.startswith('*') or above.startswith('/**') or above.startswith('/*')):
        k = j
        while k >= 0:
            s = lines[k].strip()
            if s.startswith('/**') or s.startswith('/*'):
                return k
            k -= 1
        return decl_start
    return decl_start


def clean_file(path, names):
    with open(path) as f:
        lines = f.readlines()
    ranges = []
    for i, line in enumerate(lines):
        m = DECL_RE.match(line)
        if not m:
            continue
        name = m.group(3)
        if name not in names:
            continue
        end = find_decl_end(lines, i)
        cs = find_jsdoc_start(lines, i)
        ranges.append((cs, end))
    ranges.sort()
    result = []
    skip_until = -1
    ri = 0
    removed = 0
    for i, line in enumerate(lines):
        if i <= skip_until:
            continue
        if ri < len(ranges) and i == ranges[ri][0]:
            end = ranges[ri][1]
            ri += 1
            removed += 1
            if end + 1 < len(lines) and lines[end + 1].strip() == '':
                skip_until = end + 1
            else:
                skip_until = end
            continue
        result.append(line)
    with open(path, 'w') as f:
        f.writelines(result)
    print(f"Cleaned {path}: removed {removed} declarations (ranges={ranges})")


SERVICES_TYPES_NAMES = {
    'ServiceResponse', 'PageInfo', 'LoginUserReq', 'PageResponse', 'ListResponse',
    'CacheBadgeReq', 'GroupDetailReq', 'GroupListReq', 'CacheBadgeItem', 'CacheUserReq',
    'CacheUserItem', 'GroupStatisticType', 'MessageReplyType', 'MarkMsgReq', 'MessageType',
    'MessageReq', 'RequestFriendItem', 'MsgReadUnReadCountType', 'TranslateProvider',
    'Login', 'SearchFriend', 'SearchGroup', 'ConfigType', 'AnnouncementItem', 'MockItem',
    'MediaType', 'FeedPermission', 'UnreadCount',
}

WSTYPE_NAMES = {
    'NoticeTypeEnum', 'WsReqMsgContentType', 'LoginInitResType', 'LoginSuccessResType',
    'OnStatusChangeType', 'UserStateType', 'VideoCallRequestData', 'CallResponseData',
    'SignalData', 'SignalSdp', 'CallSignalMessage', 'RoomActionData',
}

MATRIX_API_NAMES = {
    'SearchResponse', 'UserSearchResult', 'AdminUser', 'AdminRoom', 'ServerStats',
    'ModerationRule', 'ModerationAction', 'WidgetData', 'WidgetEventContent', 'VoIPFeed',
    'EmojiPack', 'EmojiPackResponse', 'ReadReceiptResponse', 'ServerNotification',
    'DehydratedDeviceData', 'DehydratedDeviceKey', 'SynapseExtensionEvent',
    'PaginationParams', 'PaginationResponse', 'MessageData', 'MessageListByIdsParams',
}

clean_file("/Users/ljf/Desktop/hu_ts/hula/src/services/types.ts", SERVICES_TYPES_NAMES)
clean_file("/Users/ljf/Desktop/hu_ts/hula/src/services/wsType.ts", WSTYPE_NAMES)
clean_file("/Users/ljf/Desktop/hu_ts/hula/src/types/matrix-api.ts", MATRIX_API_NAMES)
