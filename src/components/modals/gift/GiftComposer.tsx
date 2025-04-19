import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiFormattedText, ApiMessage, ApiPeer } from '../../../api/types';
import type { ThemeKey, WallPaperPatternThemeSettings } from '../../../types';
import type { GiftOption } from './GiftModal';
import {

  type ApiStarsAmount, MAIN_THREAD_ID,
} from '../../../api/types';

import { getPeerTitle, isApiPeerUser } from '../../../global/helpers/peers';
import {
  selectPeer, selectPeerPaidMessagesStars, selectTabState, selectTheme, selectThemeValues, selectUserFullInfo,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { formatCurrency } from '../../../util/formatCurrency';
import { formatStarsAsIcon } from '../../../util/localization/format';
import { useRichInput } from '../../common/richinput/useRichInput';

import useCustomBackground from '../../../hooks/useCustomBackground';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { usePatternBg } from '../../../hooks/usePatternBg';
import useThrottledCallback from '../../../hooks/useThrottledCallback';

import PremiumProgress from '../../common/PremiumProgress';
import RichInput from '../../common/richinput/RichInput';
import ActionMessage from '../../middle/message/ActionMessage';;
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';

import styles from './GiftComposer.module.scss';

export type OwnProps = {
  gift: GiftOption;
  giftByStars?: GiftOption;
  peerId: string;
};

export type StateProps = {
  fill?: WallPaperPatternThemeSettings;
  captionLimit?: number;
  theme: ThemeKey;
  isBackgroundBlurred?: boolean;
  patternColor?: string;
  customBackground?: string;
  backgroundColor?: string;
  peer?: ApiPeer;
  currentUserId?: string;
  isPaymentFormLoading?: boolean;
  starBalance?: ApiStarsAmount;
  paidMessagesStars?: number;
  areUniqueStarGiftsDisallowed?: boolean;
  shouldDisallowLimitedStarGifts?: boolean;
};

function GiftComposer({
  fill,
  gift,
  giftByStars,
  peerId,
  peer,
  captionLimit,
  theme,
  isBackgroundBlurred,
  patternColor,
  backgroundColor,
  customBackground,
  currentUserId,
  isPaymentFormLoading,
  starBalance,
  paidMessagesStars,
  areUniqueStarGiftsDisallowed,
  shouldDisallowLimitedStarGifts,
}: OwnProps & StateProps) {

  const {
    sendStarGift, sendPremiumGiftByStars, openInvoice, openGiftUpgradeModal, openStarsBalanceModal,
  } = getActions();
  const solutionInputCtx = useRichInput();

  const lang = useLang();

  const [giftMessage, setGiftMessage] = useState<ApiFormattedText>({ text: '' });
  const [shouldHideName, setShouldHideName] = useState<boolean>(false);
  const [shouldPayForUpgrade, setShouldPayForUpgrade] = useState<boolean>(false);
  const [shouldPayByStars, setShouldPayByStars] = useState<boolean>(false);

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  useEffect(() => {
    if (shouldDisallowLimitedStarGifts) {
      setShouldPayForUpgrade(true);
    }
  }, [shouldDisallowLimitedStarGifts, shouldPayForUpgrade]);

  const isStarGift = 'id' in gift;
  const hasPremiumByStars = giftByStars && 'amount' in giftByStars;
  const isPeerUser = peer && isApiPeerUser(peer);
  const isSelf = peerId === currentUserId;

  const localMessage = useMemo(() => {
    if (!isStarGift) {
      const currentGift = shouldPayByStars && hasPremiumByStars ? giftByStars : gift;
      return {
        id: -1,
        chatId: '0',
        isOutgoing: false,
        senderId: currentUserId,
        date: Math.floor(Date.now() / 1000),
        content: {
          action: {
            mediaType: 'action',
            type: 'giftPremium',
            amount: currentGift.amount,
            currency: currentGift.currency,
            months: gift.months,
            message: giftMessage?.text.length ? giftMessage : undefined,
          },
        },
      } satisfies ApiMessage;
    }

    return {
      id: -1,
      chatId: '0',
      isOutgoing: false,
      senderId: currentUserId,
      date: Math.floor(Date.now() / 1000),
      content: {
        action: {
          mediaType: 'action',
          type: 'starGift',
          message: giftMessage?.text.length ? giftMessage : undefined,
          isNameHidden: shouldHideName || undefined,
          starsToConvert: gift.starsToConvert,
          canUpgrade: shouldPayForUpgrade || undefined,
          alreadyPaidUpgradeStars: shouldPayForUpgrade ? gift.upgradeStars : undefined,
          gift,
          peerId,
          fromId: currentUserId,
        },
      },
    } satisfies ApiMessage;
  }, [currentUserId, gift, giftMessage, isStarGift,
    shouldHideName, shouldPayForUpgrade, peerId,
    shouldPayByStars, hasPremiumByStars, giftByStars]);

  const handleGiftMessageChange = useThrottledCallback(() => {
    setGiftMessage(solutionInputCtx.editable.getFormattedText(true));
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [solutionInputCtx.editable, solutionInputCtx.editable.htmlS], 400);

  useEffect(() => {
    handleGiftMessageChange();
  }, [handleGiftMessageChange, solutionInputCtx.editable.htmlS]);

  const handleShouldHideNameChange = useLastCallback(() => {
    setShouldHideName(!shouldHideName);
  });

  const handleShouldPayForUpgradeChange = useLastCallback(() => {
    setShouldPayForUpgrade(!shouldPayForUpgrade);
  });

  const toggleShouldPayByStars = useLastCallback(() => {
    if (hasPremiumByStars) setShouldPayByStars(!shouldPayByStars);
  });

  const handleOpenUpgradePreview = useLastCallback(() => {
    if (!isStarGift) return;
    openGiftUpgradeModal({
      giftId: gift.id,
      peerId,
    });
  });

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal({});
  });

  const handleMainButtonClick = useLastCallback(() => {
    if (isStarGift) {
      sendStarGift({
        peerId,
        shouldHideName,
        gift,
        message: giftMessage.text ? giftMessage : undefined,
        shouldUpgrade: shouldPayForUpgrade,
      });
      return;
    }

    if (shouldPayByStars && hasPremiumByStars) {
      sendPremiumGiftByStars({
        userId: peerId,
        months: giftByStars.months,
        amount: giftByStars.amount,
        message: giftMessage?.text.length ? giftMessage : undefined,
      });
      return;
    }

    openInvoice({
      type: 'giftcode',
      userIds: [peerId],
      currency: gift.currency,
      amount: gift.amount,
      option: gift,
      message: giftMessage.text ? giftMessage : undefined,
    });
  });

  const canUseStarsPayment = hasPremiumByStars && starBalance && (starBalance.amount > giftByStars.amount);
  function renderOptionsSection() {
    // const symbolsLeft = captionLimit ? captionLimit - giftMessage.length : undefined;

    const title = getPeerTitle(lang, peer!)!;
    return (
      <div className={styles.optionsSection}>

        <RichInput
          richInputCtx={solutionInputCtx}
          placeholder={lang('GiftMessagePlaceholder')}
          limitRemaining={captionLimit ? captionLimit - giftMessage.text.length : undefined}
        />
        {canUseStarsPayment && (
          <ListItem className={styles.switcher} narrow ripple onClick={toggleShouldPayByStars}>
            <span>
              {lang('GiftPremiumPayWithStars', {
                stars: formatStarsAsIcon(lang, giftByStars.amount, { className: styles.switcherStarIcon }),
              }, { withNodes: true })}
            </span>
            <Switcher
              checked={shouldPayByStars}
              onChange={toggleShouldPayByStars}
              label={lang('GiftPremiumPayWithStarsAcc')}
            />
          </ListItem>
        )}

        {hasPremiumByStars && starBalance && (
          <div className={styles.description}>
            {lang('GiftPremiumDescriptionYourBalance', {
              stars: formatStarsAsIcon(lang, starBalance.amount, { className: styles.switcherStarIcon }),
              link: <Link isPrimary onClick={handleGetMoreStars}>{lang('GetMoreStarsLinkText')}</Link>,
            }, {
              withNodes: true,
              withMarkdown: true,
            })}
          </div>
        )}

        {isStarGift && gift.upgradeStars && !areUniqueStarGiftsDisallowed && (
          <ListItem
            className={styles.switcher}
            narrow
            ripple
            onClick={handleShouldPayForUpgradeChange}
            disabled={shouldDisallowLimitedStarGifts}
          >
            <span>
              {lang('GiftMakeUnique', {
                stars: formatStarsAsIcon(lang, gift.upgradeStars, { className: styles.switcherStarIcon }),
              }, { withNodes: true })}
            </span>
            <Switcher
              checked={shouldPayForUpgrade}
              onChange={handleShouldPayForUpgradeChange}
              label={lang('GiftMakeUniqueAcc')}
            />
          </ListItem>
        )}
        {isStarGift && gift.upgradeStars && !areUniqueStarGiftsDisallowed && (
          <div className={styles.description}>
            {isPeerUser
              ? lang('GiftMakeUniqueDescription', {
                user: title,
                link: <Link isPrimary onClick={handleOpenUpgradePreview}>{lang('GiftMakeUniqueLink')}</Link>,
              }, {
                withNodes: true,
              })
              : lang('GiftMakeUniqueDescriptionChannel', {
                peer: title,
                link: <Link isPrimary onClick={handleOpenUpgradePreview}>{lang('GiftMakeUniqueLink')}</Link>,
              }, {
                withNodes: true,
              })}
          </div>
        )}

        {isStarGift && (
          <ListItem className={styles.switcher} narrow ripple onClick={handleShouldHideNameChange}>
            <span>{lang('GiftHideMyName')}</span>
            <Switcher
              checked={shouldHideName}
              onChange={handleShouldHideNameChange}
              label={lang('GiftHideMyName')}
            />
          </ListItem>
        )}
        {isStarGift && (
          <div className={styles.description}>
            {isSelf ? lang('GiftHideNameDescriptionSelf')
              : isPeerUser ? lang('GiftHideNameDescription', { receiver: title })
                : lang('GiftHideNameDescriptionChannel')}
          </div>
        )}
      </div>
    );
  }

  function renderFooter() {
    const amount = shouldPayByStars && hasPremiumByStars
      ? formatStarsAsIcon(lang, giftByStars.amount, { asFont: true })
      : isStarGift
        ? formatStarsAsIcon(lang, gift.stars + (shouldPayForUpgrade ? gift.upgradeStars! : 0), { asFont: true })
        : formatCurrency(lang, gift.amount, gift.currency);

    return (
      <div className={styles.footer}>
        {isStarGift && gift.availabilityRemains && (
          <PremiumProgress
            isPrimary
            progress={gift.availabilityRemains / gift.availabilityTotal!}
            rightText={lang('GiftSoldCount', {
              count: gift.availabilityTotal! - gift.availabilityRemains,
            })}
            leftText={lang('GiftLeftCount', { count: gift.availabilityRemains })}
            className={styles.limited}
          />
        )}
        <Button
          className={styles.mainButton}
          size="smaller"
          onClick={handleMainButtonClick}
          isLoading={isPaymentFormLoading}
          disabled={captionLimit ? captionLimit - giftMessage.text.length < 0 : false}
        >
          {lang('GiftSend', {
            amount,
          }, {
            withNodes: true,
          })}
        </Button>
      </div>
    );
  }

  const bgClassName = buildClassName(
    styles.background,
    styles.withTransition,
    customBackground && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
  );

  const { animDivRef, bgRef } = usePatternBg(fill);

  return (
    <div className={buildClassName(styles.root, 'custom-scroll')}>
      <div
        className={buildClassName(styles.actionMessageView, 'MessageList')}
        // @ts-ignore -- FIXME: Find a way to disable interactions but keep a11y
        inert
        style={buildStyle(
          `--pattern-color: ${patternColor}`,
          backgroundColor && `--theme-background-color: ${backgroundColor}`,
        )}
      >
        {/* <div
          className={bgClassName}
          style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
        /> */}
        <div
          className={bgClassName}
          style={buildStyle(
            customBackgroundValue && `--custom-background: ${customBackgroundValue}`,
            fill?.dark && 'background: #000;',
          )}
          ref={animDivRef}
        >
          <canvas
            ref={bgRef}
            style={buildStyle(
              !fill && 'visibility: hidden;',
              fill?.dark
            && `
              opacity: 0.25;
              -webkit-mask: center repeat;
              mask: center repeat;
              -webkit-mask-image: var(--custom-background);
              mask-image: var(--custom-background);
              mask-size: 300px;
              -webkit-mask-size: 300px;
            `,
            )}
          />
        </div>
        <ActionMessage
          key={isStarGift ? gift.id : gift.months}
          message={localMessage}
          threadId={MAIN_THREAD_ID}
          appearanceOrder={0}
        />
      </div>
      {renderOptionsSection()}
      <div className={styles.spacer} />
      {renderFooter()}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { peerId }): StateProps => {
    const theme = selectTheme(global);
    const {
      stars,
    } = global;
    const {
      isBlurred: isBackgroundBlurred,
      patternColor,
      background: customBackground,
      backgroundColor,
      fill,
    } = selectThemeValues(global, theme) || {};
    const peer = selectPeer(global, peerId);
    const paidMessagesStars = selectPeerPaidMessagesStars(global, peerId);
    const userFullInfo = selectUserFullInfo(global, peerId);
    const currentUserId = global.currentUserId;
    const isGiftForSelf = currentUserId === peerId;
    const areUniqueStarGiftsDisallowed = !isGiftForSelf
      && userFullInfo?.disallowedGifts?.shouldDisallowUniqueStarGifts;
    const shouldDisallowLimitedStarGifts = !isGiftForSelf
      && userFullInfo?.disallowedGifts?.shouldDisallowLimitedStarGifts;

    const tabState = selectTabState(global);

    return {
      starBalance: stars?.balance,
      fill,
      peer,
      theme,
      isBackgroundBlurred,
      patternColor,
      customBackground,
      backgroundColor,
      captionLimit: global.appConfig?.starGiftMaxMessageLength,
      currentUserId: global.currentUserId,
      isPaymentFormLoading: tabState.isPaymentFormLoading,
      paidMessagesStars,
      areUniqueStarGiftsDisallowed,
      shouldDisallowLimitedStarGifts,
    };
  },
)(GiftComposer));
