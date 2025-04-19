import type { StateHookSetter } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiAttachment,
  ApiFormattedText,
  ApiMessage,
} from '../../../../api/types';
import type { PasteCtx } from '../../../common/richinput/RichEditable';
import type { RichInputCtx } from '../../../common/richinput/useRichEditable';

import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import {
  canReplaceMessageMedia,
  isUploadingFileSticker,
} from '../../../../global/helpers';
import {
  containsCustomEmoji,
  stripCustomEmoji,
} from '../../../../global/helpers/symbols';
import {
  useRichEditablePasteHandler,
} from '../../../common/richinput/useRichEditable';
import buildAttachment from '../helpers/buildAttachment';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

import useOldLang from '../../../../hooks/useOldLang';

const TYPE_HTML = 'text/html';
const DOCUMENT_TYPE_WORD = 'urn:schemas-microsoft-com:office:word';
const NAMESPACE_PREFIX_WORD = 'xmlns:w';

const useClipboardPaste = (
  isActive: boolean,
  richInputCtx: RichInputCtx,
  setAttachments: StateHookSetter<ApiAttachment[]>,
  setNextText: StateHookSetter<ApiFormattedText | undefined>,
  editedMessage: ApiMessage | undefined,
  shouldStripCustomEmoji?: boolean,
  onCustomEmojiStripped?: VoidFunction,
) => {
  const { showNotification } = getActions();
  const lang = useOldLang();

  useRichEditablePasteHandler(
    richInputCtx,
    async (p: PasteCtx) => {
      if (p.text && containsCustomEmoji(p.text) && shouldStripCustomEmoji) {
        p.text = stripCustomEmoji(p.text);
        onCustomEmojiStripped?.();
      }

      const items = p.items;
      let files: File[] | undefined = [];

      if (items.length > 0) {
        files = await getFilesFromDataTransferItems(items);
        if (editedMessage) {
          files = files?.slice(0, 1);
        }
      }

      if (!files?.length && !p.text.text) {
        return;
      }

      let isWordDocument = false;
      try {
        const parser = new DOMParser();
        const parsedDocument = parser.parseFromString(p.html, TYPE_HTML);
        isWordDocument = parsedDocument.documentElement.getAttribute(NAMESPACE_PREFIX_WORD)
          === DOCUMENT_TYPE_WORD;
      } catch (err: any) {
        // Ignore
      }

      const hasText = p.text.text;
      let shouldSetAttachments = files?.length && !isWordDocument;

      const newAttachments = files
        ? await Promise.all(
          files.map((file) => buildAttachment(file.name, file)),
        )
        : [];
      const canReplace = (editedMessage
          && newAttachments?.length
          && canReplaceMessageMedia(editedMessage, newAttachments[0]))
        || Boolean(hasText);
      const isUploadingDocumentSticker = isUploadingFileSticker(
        newAttachments[0],
      );
      const isInAlbum = editedMessage && editedMessage?.groupedId;

      if (editedMessage && isUploadingDocumentSticker) {
        showNotification({
          message: lang(
            isInAlbum
              ? 'lng_edit_media_album_error'
              : 'lng_edit_media_invalid_file',
          ),
        });
        return;
      }

      if (isInAlbum) {
        shouldSetAttachments = canReplace;
        if (!shouldSetAttachments) {
          showNotification({ message: lang('lng_edit_media_album_error') });
          return;
        }
      }

      if (shouldSetAttachments) {
        requestNextMutation(() => {
          setAttachments(
            editedMessage
              ? newAttachments
              : (attachments) => attachments.concat(newAttachments),
          );
        });
      }
    },
    isActive,
  );
};

export default useClipboardPaste;
