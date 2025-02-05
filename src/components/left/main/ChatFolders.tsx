import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite, ApiSession } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import type { LeftColumnContent } from '../../../types';
import type { MenuItemContextAction } from '../../ui/ListItem';
import type { TabWithProperties } from '../../ui/TabList';
import { SettingsScreens } from '../../../types';

import { ALL_FOLDER_ID } from '../../../config';
import { selectCanShareFolder, selectIsCurrentUserFrozen, selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useDerivedState from '../../../hooks/useDerivedState';
import {
  useFolderManagerForUnreadChatsByFolder,
  useFolderManagerForUnreadCounters,
} from '../../../hooks/useFolderManager';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import StoryRibbon from '../../story/StoryRibbon';
import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import ChatList from './ChatList';

type OwnProps = {
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
  shouldHideFolderTabs?: boolean;
  isForumPanelOpen?: boolean;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  shouldSkipHistoryAnimations?: boolean;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
  hasArchivedChats?: boolean;
  hasArchivedStories?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isStoryRibbonShown?: boolean;
  sessions?: Record<string, ApiSession>;
  isAccountFrozen?: boolean;
};

const SAVED_MESSAGES_HOTKEY = '0';
const FIRST_FOLDER_INDEX = 0;

const ChatFolders: FC<OwnProps & StateProps> = ({
  foldersDispatch,
  onSettingsScreenSelect,
  onLeftColumnContentChange,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  isForumPanelOpen,
  shouldSkipHistoryAnimations,
  maxFolders,
  maxChatLists,
  shouldHideFolderTabs,
  folderInvitesById,
  maxFolderInvites,
  hasArchivedChats,
  hasArchivedStories,
  archiveSettings,
  isStoryRibbonShown,
  sessions,
  isAccountFrozen,
}) => {
  const {
    loadChatFolders,
    setActiveChatFolder,
    openChat,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
    markChatMessagesRead,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  useEffect(() => {
    loadChatFolders();
  }, []);

  const {
    ref,
    shouldRender: shouldRenderStoryRibbon,
    getIsClosing: getIsStoryRibbonClosing,
  } = useShowTransition({
    isOpen: isStoryRibbonShown,
    className: false,
    withShouldRender: true,
  });
  const isStoryRibbonClosing = useDerivedState(getIsStoryRibbonClosing);

  const scrollToTop = useLastCallback(() => {
    const activeList = ref.current?.querySelector<HTMLElement>('.chat-list.Transition_slide-active');
    activeList?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  });

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder;
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  const allChatsFolderIndex = displayedFolders?.findIndex((folder) => folder.id === ALL_FOLDER_ID);
  const isInAllChatsFolder = allChatsFolderIndex === activeChatFolder;
  const isInFirstFolder = FIRST_FOLDER_INDEX === activeChatFolder;

  const folderUnreadChatsCountersById = useFolderManagerForUnreadChatsByFolder();
  const handleReadAllChats = useLastCallback((folderId: number) => {
    const unreadChatIds = folderUnreadChatsCountersById[folderId];
    if (!unreadChatIds?.length) return;

    unreadChatIds.forEach((chatId) => {
      markChatMessagesRead({ id: chatId });
    });
  });

  const folderCountersById = useFolderManagerForUnreadCounters();
  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map((folder, i) => {
      const { id, title } = folder;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id === ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEditFolders'),
          icon: 'edit',
          handler: () => {
            onSettingsScreenSelect(SettingsScreens.Folders);
          },
        });

        if (folderUnreadChatsCountersById[id]?.length) {
          contextActions.push({
            title: lang('ChatListMarkAllAsRead'),
            icon: 'readchats',
            handler: () => handleReadAllChats(folder.id),
          });
        }
      } else {
        contextActions.push({
          title: lang('EditFolder'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        if (folderUnreadChatsCountersById[id]?.length) {
          contextActions.push({
            title: lang('ChatListMarkAllAsRead'),
            icon: 'readchats',
            handler: () => handleReadAllChats(folder.id),
          });
        }

        contextActions.push({
          title: lang('FilterMenuDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }
      const tabText = renderTextWithEntities({
        text: title.text,
        entities: title.entities,
        noCustomEmojiPlayback: folder.noTitleAnimations,
      });
      const tabIcon = <>
        <svg className="tabIcon" width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6.21265 9.53789C6 10.1456 6 10.9016 6 12.4135C6 12.6655 6 12.7915 6.03544 12.8928C6.09892 13.0742 6.24156 13.2169 6.42298 13.2803C6.52427 13.3158 6.65026 13.3158 6.90226 13.3158H29.2421C29.3595 13.3158 29.4181 13.3158 29.4672 13.308C29.7375 13.2652 29.9494 13.0533 29.9922 12.783C30 12.7339 30 12.6752 30 12.5579C30 12.0885 30 11.8538 29.9689 11.6574C29.7977 10.5764 28.9499 9.72863 27.8689 9.55742C27.6725 9.52632 27.4378 9.52632 26.9684 9.52632H19.1548C18.9418 9.52632 18.8353 9.52632 18.7327 9.52075C17.8706 9.47396 17.0503 9.13419 16.4077 8.55768C16.3312 8.48907 16.2559 8.41377 16.1053 8.26319C15.9547 8.1126 15.8794 8.03725 15.8029 7.96863C15.1602 7.39213 14.3399 7.05236 13.4778 7.00557C13.3752 7 13.2687 7 13.0557 7H11.4135C9.90159 7 9.14562 7 8.53789 7.21265C7.44937 7.59354 6.59354 8.44937 6.21265 9.53789Z" fill="currentColor" />
          <path d="M6.20651 16.8766C6 17.282 6 17.8125 6 18.8737V20.3895C6 23.2192 6 24.6341 6.5507 25.7149C7.03512 26.6656 7.80807 27.4386 8.75878 27.923C9.8396 28.4737 11.2545 28.4737 14.0842 28.4737H21.9158C24.7455 28.4737 26.1604 28.4737 27.2412 27.923C28.1919 27.4386 28.9649 26.6656 29.4493 25.7149C30 24.6341 30 23.2192 30 20.3895V18.8737C30 17.8125 30 17.282 29.7935 16.8766C29.6118 16.5201 29.322 16.2303 28.9655 16.0486C28.5602 15.8421 28.0296 15.8421 26.9684 15.8421H9.03158C7.97043 15.8421 7.43985 15.8421 7.03454 16.0486C6.67803 16.2303 6.38817 16.5201 6.20651 16.8766Z" fill="currentColor" />
        </svg>

      </>
      return {
        id,
        title: <>{tabIcon}{tabText}</>,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
      } satisfies TabWithProperties;
    });
  }, [
    displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
    maxFolderInvites, folderUnreadChatsCountersById, onSettingsScreenSelect,
  ]);

  const handleSwitchTab = useLastCallback((index: number) => {
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
    if (activeChatFolder === index) {
      scrollToTop();
    }
  });

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs?.length) {
      return;
    }

    if (activeChatFolder >= folderTabs.length) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }, [activeChatFolder, folderTabs, setActiveChatFolder]);

  useEffect(() => {
    if (!IS_TOUCH_ENV || !folderTabs?.length || isForumPanelOpen) {
      return undefined;
    }

    return captureEvents(transitionRef.current!, {
      selectorToPreventScroll: '.chat-list',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveChatFolder(
            { activeChatFolder: Math.min(activeChatFolder + 1, folderTabs.length - 1) },
            { forceOnHeavyAnimation: true },
          );
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveChatFolder({ activeChatFolder: Math.max(0, activeChatFolder - 1) }, { forceOnHeavyAnimation: true });
          return true;
        }

        return false;
      }),
    });
  }, [activeChatFolder, folderTabs, isForumPanelOpen, setActiveChatFolder]);

  const isNotInFirstFolderRef = useRef();
  isNotInFirstFolderRef.current = !isInFirstFolder;
  useEffect(() => (isNotInFirstFolderRef.current ? captureEscKeyListener(() => {
    if (isNotInFirstFolderRef.current) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }) : undefined), [activeChatFolder, setActiveChatFolder]);

  useHistoryBack({
    isActive: !isInFirstFolder,
    onBack: () => setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX }, { forceOnHeavyAnimation: true }),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code.startsWith('Digit') && folderTabs) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        if (digit === SAVED_MESSAGES_HOTKEY) {
          openChat({ id: currentUserId, shouldReplaceHistory: true });
          return;
        }

        const folder = Number(digit) - 1;
        if (folder > folderTabs.length - 1) return;

        setActiveChatFolder({ activeChatFolder: folder }, { forceOnHeavyAnimation: true });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUserId, folderTabs, openChat, setActiveChatFolder]);

  const {
    ref: placeholderRef,
    shouldRender: shouldRenderPlaceholder,
  } = useShowTransition({
    isOpen: !orderedFolderIds,
    noMountTransition: true,
    withShouldRender: true,
  });

  function renderCurrentTab(isActive: boolean) {
    const activeFolder = Object.values(chatFoldersById)
      .find(({ id }) => id === folderTabs![activeChatFolder].id);
    const isFolder = activeFolder && !isInAllChatsFolder;

    return (
      <ChatList
        folderType={isFolder ? 'folder' : 'all'}
        folderId={isFolder ? activeFolder.id : undefined}
        isActive={isActive}
        isForumPanelOpen={isForumPanelOpen}
        foldersDispatch={foldersDispatch}
        onSettingsScreenSelect={onSettingsScreenSelect}
        onLeftColumnContentChange={onLeftColumnContentChange}
        canDisplayArchive={(hasArchivedChats || hasArchivedStories) && !archiveSettings.isHidden}
        archiveSettings={archiveSettings}
        sessions={sessions}
        isAccountFrozen={isAccountFrozen}
      />
    );
  }

  const shouldRenderFolders = folderTabs && folderTabs.length > 1;

  return (
    <>
      <div
        ref={ref}
        className={buildClassName(
          'ChatFolders',
          shouldRenderFolders && shouldHideFolderTabs && 'ChatFolders--tabs-hidden',
          shouldRenderStoryRibbon && 'with-story-ribbon',
        )}
      >
        {shouldRenderStoryRibbon && <StoryRibbon isClosing={isStoryRibbonClosing} />}
        {shouldRenderFolders ? (
          <TabList
            contextRootElementSelector="#LeftColumn"
            tabs={folderTabs}
            activeTab={activeChatFolder}
            onSwitchTab={handleSwitchTab}
          />
        ) : shouldRenderPlaceholder ? (
          <div ref={placeholderRef} className="tabs-placeholder" />
        ) : undefined}
        <Transition
          ref={transitionRef}
          name={shouldSkipHistoryAnimations ? 'none' : lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
          activeKey={activeChatFolder}
          renderCount={shouldRenderFolders ? folderTabs.length : undefined}
        >
          {(isActive: boolean) => {
            return <>
              {renderCurrentTab(isActive)}
            </>
          }}
        </Transition>
      </div>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
      chats: {
        listIds: {
          archived,
        },
      },
      stories: {
        orderedPeerIds: {
          archived: archivedStories,
        },
      },
      activeSessions: {
        byHash: sessions,
      },
      currentUserId,
      archiveSettings,
    } = global;
    const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);
    const { storyViewer: { isRibbonShown: isStoryRibbonShown } } = selectTabState(global);
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    return {
      chatFoldersById,
      folderInvitesById,
      orderedFolderIds,
      activeChatFolder,
      currentUserId,
      shouldSkipHistoryAnimations,
      hasArchivedChats: Boolean(archived?.length),
      hasArchivedStories: Boolean(archivedStories?.length),
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      archiveSettings,
      isStoryRibbonShown,
      sessions,
      isAccountFrozen,
    };
  },
)(ChatFolders));
