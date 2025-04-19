import { useEffect, useState } from '../../../../lib/teact/teact';

import captureKeyboardListeners from '../../../../util/captureKeyboardListeners';
import cycleRestrict from '../../../../util/cycleRestrict';

import useLastCallback from '../../../../hooks/useLastCallback';

export function useKeyboardNavigation({
  isActive,
  isHorizontal,
  shouldSaveSelectionOnUpdateItems,
  shouldRemoveSelectionOnReset,
  shouldStartOnFirstItem,
  noArrowSelectLoop,
  noArrowNavigation,
  items,
  shouldSelectOnTab,
  onSelect,
  onClose,
}: {
  isActive: boolean;
  isHorizontal?: boolean;
  shouldSaveSelectionOnUpdateItems?: boolean;
  shouldRemoveSelectionOnReset?: boolean;
  shouldStartOnFirstItem?: boolean;
  noArrowSelectLoop?: boolean;
  noArrowNavigation?: boolean;
  items?: any[];
  shouldSelectOnTab?: boolean;
  onSelect: (item: any) => void | boolean;
  onClose: NoneToVoidFunction;
}) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(shouldStartOnFirstItem ? 0 : -1);

  const getSelectedIndex = useLastCallback((newIndex: number) => {
    if (!items) {
      return -1;
    }

    return cycleRestrict(items.length, newIndex);
  });

  const handleArrowKey = useLastCallback((value: number, e: KeyboardEvent) => {
    const outOfBounds = (selectedItemIndex + value < 0 || selectedItemIndex + value > (items?.length ?? 10000) - 1);
    if (noArrowSelectLoop && outOfBounds) {
      return;
    }

    e.preventDefault();
    setSelectedItemIndex((index) => (getSelectedIndex(index + value)));
  });

  const handleItemSelect = useLastCallback((e: KeyboardEvent) => {
    // Prevent action on key combinations
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    if (!isActive) return false;

    if (items && items.length && selectedItemIndex > -1) {
      const item = items[selectedItemIndex];
      if (item) {
        if (onSelect(item) === false) {
          return false;
        }

        e.preventDefault();
      }
    }

    return true;
  });

  useEffect(() => {
    if (!isActive) setSelectedItemIndex(shouldRemoveSelectionOnReset ? -1 : 0);
  }, [isActive, shouldRemoveSelectionOnReset]);

  const isSelectionOutOfRange = !items || selectedItemIndex > items.length - 1;
  useEffect(() => {
    if (!shouldSaveSelectionOnUpdateItems || isSelectionOutOfRange) {
      setSelectedItemIndex(shouldRemoveSelectionOnReset ? -1 : 0);
    }
  }, [isSelectionOutOfRange, shouldRemoveSelectionOnReset, shouldSaveSelectionOnUpdateItems]);

  useEffect(() => (isActive ? captureKeyboardListeners({
    onEsc: onClose,
    onUp: noArrowNavigation || isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(-1, e),
    onDown: noArrowNavigation || isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(1, e),
    onLeft: noArrowNavigation || !isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(-1, e),
    onRight: noArrowNavigation || !isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(1, e),
    onTab: shouldSelectOnTab ? handleItemSelect : undefined,
    onEnter: handleItemSelect,
  }) : undefined), [
    noArrowNavigation, handleArrowKey, handleItemSelect, isActive, isHorizontal, onClose, shouldSelectOnTab,
  ]);

  return selectedItemIndex;
}
