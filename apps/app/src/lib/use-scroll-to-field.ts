import { useCallback, type RefObject } from "react";
import { findNodeHandle, type FlatList, type TextInput } from "react-native";

/**
 * FlatList footer 안 필드에 오류가 났을 때 필드를 먼저 보이게 한 뒤 포커스한다.
 * 단순 scrollToEnd보다 measureLayout을 우선해 큰 글자·320dp에서도 해당 필드가
 * 키보드 뒤에 남지 않게 한다.
 */
export function useScrollToField<ItemT>(listRef: RefObject<FlatList<ItemT> | null>) {
  return useCallback(
    (fieldRef: RefObject<TextInput | null>) => {
      const list = listRef.current;
      const field = fieldRef.current;
      const scrollNode = list?.getNativeScrollRef();
      const scrollHandle = scrollNode ? findNodeHandle(scrollNode) : null;

      if (!list || !field || scrollHandle === null) {
        list?.scrollToEnd({ animated: true });
        setTimeout(() => field?.focus(), 220);
        return;
      }

      field.measureLayout(
        scrollHandle,
        (_x, y) => {
          list.scrollToOffset({ offset: Math.max(0, y - 28), animated: true });
          setTimeout(() => field.focus(), 220);
        },
        () => {
          list.scrollToEnd({ animated: true });
          setTimeout(() => field.focus(), 220);
        },
      );
    },
    [listRef],
  );
}
