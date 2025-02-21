export enum RichInputKeyboardPriority {
  Composer = 10,
  Tool = 1,
  Default = 0,
}

export type RichInputKeyboardListener = {
  priority: RichInputKeyboardPriority;
  onKeydown: (event: KeyboardEvent) => boolean;
};
