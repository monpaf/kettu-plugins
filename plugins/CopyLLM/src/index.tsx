
import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { findByProps } from "@vendetta/metro";
import { React, clipboard } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const { FormRow, FormIcon } = Forms;

const unpatch = before("openLazy", LazyActionSheet, ([component, key, msg]) => {
  const message = msg?.message;
  
  if (key !== "MessageLongPressActionSheet" || !message) return;

  component.then((instance) => {
    const unpatchInstance = after("default", instance, (_, componentProps) => {
      React.useEffect(() => () => { unpatchInstance(); }, []);

      const actionSheetContainer = findInReactTree(
        componentProps,
        (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
      );
      const buttons = findInReactTree(
        componentProps,
        (x) => x?.[0]?.type?.name === "ButtonRow",
      );

      // 1. Déduction du nom de l'auteur principal
      const authorName = message.nick || message.author?.globalName || message.author?.username || "Inconnu";
      
      // 2. Formatage de l'horodatage
      let timeString = "";
      if (message.timestamp) {
        const date = new Date(message.timestamp);
        const pad = (n: number) => n.toString().padStart(2, '0');
        // Format [JJ/MM HH:MM]
        timeString = `[${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}] `;
      }

      // 3. Gestion de la réponse (si le message répond à quelqu'un)
      let replyString = "";
      if (message.referenced_message) {
        const refMsg = message.referenced_message;
        const refAuthorName = refMsg.nick || refMsg.author?.globalName || refMsg.author?.username || "Inconnu";
        replyString = `(En réponse à ${refAuthorName}) `;
      }

      // 4. Assemblage final pour le LLM
      const formattedText = `${timeString}${replyString}${authorName} : ${message.content}`;

      const handlePress = () => {
        LazyActionSheet.hideActionSheet();
        clipboard.setString(formattedText);
        showToast("Copié avec contexte", getAssetIDByName("toast_copy_link"));
      };

      if (buttons) {
        buttons.push(
          <FormRow
            label="Copier pour LLM"
            leading={
              <FormIcon
                style={{ opacity: 1 }}
                source={getAssetIDByName("toast_copy_link")}
              />
            }
            onPress={handlePress}
          />,
        );
      } else if (actionSheetContainer && actionSheetContainer[1]) {
        const middleGroup = actionSheetContainer[1];
        const ActionSheetRow = middleGroup.props.children[0].type;

        const copyForLlmButton = (
          <ActionSheetRow
            label="Copier pour LLM"
            icon={{
              $$typeof: middleGroup.props.children[0].props.icon.$$typeof,
              type: middleGroup.props.children[0].props.icon.type,
              key: null,
              ref: null,
              props: {
                IconComponent: () => (
                  <FormIcon
                    style={{ opacity: 1 }}
                    source={getAssetIDByName("toast_copy_link")}
                  />
                ),
              },
            }}
            onPress={handlePress}
            key="copy-for-llm"
          />
        );

        middleGroup.props.children.push(copyForLlmButton);
      } else {
        console.log("[CopyForLLM] Erreur : Impossible de trouver l'ActionSheet");
      }
    });
  });
});

export const onUnload = () => unpatch();
