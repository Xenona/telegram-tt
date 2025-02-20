import type { RefObject } from 'react';
import { useEffect, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiChatMember, ApiUser } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { getMainUsername, getUserFirstOrLastName } from '../../../../global/helpers';
import { filterPeersByQuery } from '../../../../global/helpers/peers';
import focusEditableElement from '../../../../util/focusEditableElement';
import { pickTruthy, unique } from '../../../../util/iteratees';
import { getCaretPosition, getHtmlBeforeSelection, setCaretPosition } from '../../../../util/selection';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import { RichInputCtx } from '../../../common/richinput/useRichInput';

const THROTTLE = 300;

let RE_USERNAME_SEARCH: RegExp;
try {
  RE_USERNAME_SEARCH = /(^|\s)@[-_\p{L}\p{M}\p{N}]*$/gui;
} catch (e) {
  // Support for older versions of Firefox
  RE_USERNAME_SEARCH = /(^|\s)@[-_\d\wа-яёґєії]*$/gi;
}

export default function useMentionTooltip(
  isEnabled: boolean,
  richInputCtx: RichInputCtx,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: string[],
  currentUserId?: string,
) {
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);
  
  const extractUsernameTagThrottled = useThrottledResolver(() => {
    const text = richInputCtx.editable.matchableS();
    if (!isEnabled || !richInputCtx.editable.selectionS()?.collapsed) return undefined
    if (!text || !text.includes('@')) return undefined;

    const matches = text.match(RE_USERNAME_SEARCH);
    if(!matches || matches.length == 0) return undefined;
    return matches[matches.length - 1].trim();
  }, [isEnabled, richInputCtx.editable.matchableS], THROTTLE);

  const getUsernameTag = useDerivedSignal(
    extractUsernameTagThrottled, [extractUsernameTagThrottled, richInputCtx.editable.matchableS], true,
  );

  const getWithInlineBots = useDerivedSignal(() => {
    return isEnabled && richInputCtx.editable.htmlS().startsWith('@');
  }, [richInputCtx.editable.htmlS, isEnabled]);

  useEffect(() => {
    const usernameTag = getUsernameTag();

    if (!usernameTag || !(groupChatMembers || topInlineBotIds)) {
      setFilteredUsers(undefined);
      return;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    if (!usersById) {
      setFilteredUsers(undefined);
      return;
    }

    const memberIds = groupChatMembers?.reduce((acc: string[], member) => {
      if (member.userId !== currentUserId) {
        acc.push(member.userId);
      }

      return acc;
    }, []);

    const filter = usernameTag.substring(1);
    const filteredIds = filterPeersByQuery({
      ids: unique([
        ...((getWithInlineBots() && topInlineBotIds) || []),
        ...(memberIds || []),
      ]),
      query: filter,
      type: 'user',
    });

    setFilteredUsers(Object.values(pickTruthy(usersById, filteredIds)));
  }, [currentUserId, groupChatMembers, topInlineBotIds, getUsernameTag, getWithInlineBots]);

  const insertMention = useLastCallback((user: ApiUser, forceFocus = false) => {
    if (!user.usernames && !getUserFirstOrLastName(user)) {
      return;
    }

    const mainUsername = getMainUsername(user);
    const userFirstOrLastName = getUserFirstOrLastName(user) || '';
    const htmlToInsert = mainUsername
      ? `@${mainUsername} `
      : `<a
          class="text-entity-link"
          data-entity-type="${ApiMessageEntityTypes.MentionName}"
          data-user-id="${user.id}"
          contenteditable="false"
          dir="auto"
        >${userFirstOrLastName}</a> `;

    richInputCtx.editable.insertMatchableHtml(htmlToInsert, c => c == '@');

    setFilteredUsers(undefined);
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richInputCtx.editable.htmlS]);

  return {
    isMentionTooltipOpen: Boolean(filteredUsers?.length && !isManuallyClosed),
    closeMentionTooltip: markManuallyClosed,
    insertMention,
    mentionFilteredUsers: filteredUsers,
  };
}

