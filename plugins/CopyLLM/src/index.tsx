import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { findByName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import CopyMenu from "./CopyMenu"; // On importe la nouvelle page

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const Navigation = findByProps("push", "pushLazy", "pop");
const modalCloseButton =
  findByProps("getRenderCloseButton")?.getRenderCloseButton ??
  findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
const Navigator = findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
const { FormRow, FormIcon } = Forms;

const unpatch = before("openLazy", LazyActionSheet, ([component, key, msg]) => {
  const message = msg?.message;
  if (key !== "MessageLongPressActionSheet" || !message) return;

  component.then((instance) => {
    const unpatchInstance = after("default", instance, (_, componentProps) => {
      React.useEffect(() => () => { unpatchInstance(); }, []);

      // Configuration de la page qui va s'ouvrir
      const navigator = () => (
        <Navigator
          initialRouteName="CopyMenu"
          goBackOnBackPress
          screens={{
            CopyMenu: {
              title: "Copier pour LLM",
              headerLeft: modalCloseButton?.(() => Navigation.pop()),
              render: () => <CopyMenu message={message} />,
            },
          }}
        />
      );

      const actionSheetContainer = findInReactTree(
        componentProps,
        (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup"
      );
      const buttons = findInReactTree(
        componentProps,
        (x) => x?.[0]?.type?.name === "ButtonRow"
      );

      const openMenu = () => {
        LazyActionSheet.hideActionSheet();
        Navigation.push(navigator);
      };

      if (buttons) {
        buttons.push(
          <FormRow
            label="Copier pour LLM"
            leading={<FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_chat_bubble_16px")} />}
            onPress={openMenu}
          />
        );
      } else if (actionSheetContainer && actionSheetContainer[1]) {
        const middleGroup = actionSheetContainer[1];
        const ActionSheetRow = middleGroup.props.children[0].type;
        const iconProps = middleGroup.props.children[0].props.icon;

        const copyButton = (
          <ActionSheetRow
            label="Copier pour LLM"
            icon={{
              $$typeof: iconProps.$$typeof,
              type: iconProps.type,
              key: null,
              ref: null,
              props: {
                IconComponent: () => (
                  <FormIcon style={{ opacity: 1 }} source={getAssetIDByName("ic_chat_bubble_32px")} />
                ),
              },
            }}
            onPress={openMenu}
            key="copy-llm-menu"
          />
        );

        middleGroup.props.children.push(copyButton);
      }
    });
  });
});

export const onUnload = () => unpatch();

