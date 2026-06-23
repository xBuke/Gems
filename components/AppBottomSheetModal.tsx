import { BottomSheetHandle } from '@/components/BottomSheetHandle';
import { useTheme } from '@/lib/ThemeContext';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

export type AppBottomSheetModalRef = {
  present: () => void;
  dismiss: () => void;
};

type AppBottomSheetModalProps = {
  visible?: boolean;
  onClose: () => void;
  children: ReactNode;
  snapPoints?: (string | number)[];
  enableBackdrop?: boolean;
};

export const AppBottomSheetModal = forwardRef<AppBottomSheetModalRef, AppBottomSheetModalProps>(
  function AppBottomSheetModal(
    {
      visible,
      onClose,
      children,
      snapPoints: snapPointsProp,
      enableBackdrop = true,
    },
    forwardedRef,
  ) {
    const { theme } = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const hasPresentedRef = useRef(false);

    const snapPoints = useMemo(() => snapPointsProp ?? ['50%'], [snapPointsProp]);

    const present = useCallback(() => {
      requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
    }, []);

    const dismiss = useCallback(() => {
      sheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(
      forwardedRef,
      () => ({
        present,
        dismiss,
      }),
      [present, dismiss],
    );

    useEffect(() => {
      if (visible === undefined) return;

      if (visible) {
        hasPresentedRef.current = true;
        present();
        return;
      }

      if (hasPresentedRef.current) {
        dismiss();
        hasPresentedRef.current = false;
      }
    }, [visible, present, dismiss]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.45}
          pressBehavior="close"
        />
      ),
      [],
    );

    const handleDismiss = useCallback(() => {
      hasPresentedRef.current = false;
      onClose();
    }, [onClose]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        handleComponent={BottomSheetHandle}
        backdropComponent={enableBackdrop ? renderBackdrop : undefined}
        onDismiss={handleDismiss}
        backgroundStyle={{ backgroundColor: theme.card }}
        activeOffsetY={[-1, 1]}>
        {children}
      </BottomSheetModal>
    );
  },
);
