
import { ReactNative, clipboard, React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Button } from "@vendetta/ui/components";
import { findByProps, findByStoreName } from "@vendetta/metro";

const { ScrollView } = ReactNative;
const MessageStore = findByStoreName("MessageStore") || findByProps("getMessage", "getMessages");
const UserStore = findByStoreName("UserStore") || findByProps("getUser", "getCurrentUser");

// Nouvelle fonction qui force la vérification du profil actuel dans le UserStore
const getAuthorName = (m: any) => {
  if (!m) return null;
  
  let userObj = m;
  
  // Si on a un ID, on force la récupération du profil actuel et à jour depuis le cache de l'app
  const userId = m.author?.id || m.id || m.userId;
  if (userId && UserStore?.getUser) {
    const freshUser = UserStore.getUser(userId);
    if (freshUser) userObj = freshUser;
  }

  // On extrait le nom (priorité au nom d'utilisateur technique, puis au surnom/global)
  return userObj.username || userObj.nick || userObj.globalName || null;
};

const formatMessage = (m: any) => {
  if (!m || (!m.content && (!m.attachments || m.attachments.length === 0))) return "";
  
  const authorName = getAuthorName(m) || "Inconnu";
  
  let timeString = "";
  if (m.timestamp) {
    const date = new Date(m.timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    timeString = `[${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}] `;
  }

  let replyString = "";
  let refAuthor = null;

  if (m.referenced_message) refAuthor = getAuthorName(m.referenced_message);
  if (!refAuthor && m.referencedMessage?.message) refAuthor = getAuthorName(m.referencedMessage.message);
  
  if (!refAuthor && m.messageReference?.message_id && MessageStore?.getMessage) {
    const refMsg = MessageStore.getMessage(m.channel_id, m.messageReference.message_id);
    if (refMsg) refAuthor = getAuthorName(refMsg);
  }

  if (!refAuthor && m.mentions && Array.isArray(m.mentions) && m.mentions.length > 0) {
    const mention = m.mentions[0];
    if (typeof mention === 'string') {
      const user = UserStore?.getUser(mention);
      if (user) refAuthor = getAuthorName(user);
    } 
    else if (typeof mention === 'object') {
      // On extrait l'ID de la mention pour aller chercher le profil frais
      const id = mention.id || mention.userId;
      if (id && UserStore?.getUser) {
        const user = UserStore.getUser(id);
        if (user) refAuthor = getAuthorName(user);
      }
      // Si on n'a vraiment pas trouvé dans le Store, on utilise les données de la mention
      if (!refAuthor) refAuthor = getAuthorName(mention); 
    }
  }

  if (refAuthor) {
    replyString = `(En réponse à ${refAuthor}) `;
  }

  const content = m.content || "[Pièce jointe/Image]";
  return `${timeString}${replyString}${authorName} : ${content}`;
};

export default function CopyMenu({ message }) {
  const style = { marginBottom: 8 };

  const handleCopy = (totalCount: number) => {
    try {
      if (totalCount === 1) {
        clipboard.setString(formatMessage(message));
        showToast("1 message copié", getAssetIDByName("toast_copy_link"));
        return;
      }

      if (!MessageStore || !MessageStore.getMessages) throw new Error("Store introuvable");

      const channelMessages = MessageStore.getMessages(message.channel_id);
      if (!channelMessages) throw new Error("Historique introuvable");

      let msgArray: any[] = [];

      if (typeof channelMessages.toArray === 'function') {
        msgArray = channelMessages.toArray();
      } else if (Array.isArray(channelMessages)) {
        msgArray = channelMessages;
      } else if (channelMessages._array && Array.isArray(channelMessages._array)) {
        msgArray = channelMessages._array;
      } else if (channelMessages.messages && Array.isArray(channelMessages.messages)) {
        msgArray = channelMessages.messages;
      } else if (channelMessages._map) {
        msgArray = Array.from(channelMessages._map.values());
      } else {
        msgArray = Object.values(channelMessages);
      }

      msgArray = msgArray.filter(m => m && m.id);

      if (!msgArray || msgArray.length === 0) {
         throw new Error("Impossible d'extraire la liste");
      }

      const index = msgArray.findIndex((m: any) => m.id === message.id);
      if (index === -1) {
        throw new Error("Message introuvable dans la liste");
      }

      let messagesToCopy = msgArray.slice(index, index + totalCount);
      
      const formattedText = messagesToCopy
        .map(formatMessage)
        .filter((text: string) => text.trim() !== "")
        .join('\n\n---\n\n');

      clipboard.setString(formattedText);
      showToast(`${messagesToCopy.length} messages copiés`, getAssetIDByName("toast_copy_link"));

    } catch (error: any) {
      console.error("[CopyForLLM] Erreur :", error);
      clipboard.setString(formatMessage(message));
      showToast(`Erreur: ${error?.message || "Inconnue"}`, getAssetIDByName("ic_warning_24px"));
    }
  };

  return (
    <ScrollView style={{ flex: 1, marginHorizontal: 13, marginVertical: 10 }}>
      <Button style={style} text="Copier le message (1)" color="brand" size="small" onPress={() => handleCopy(1)} />
      <Button style={style} text="Copier 5 messages" color="brand" size="small" onPress={() => handleCopy(5)} />
      <Button style={style} text="Copier 10 messages" color="brand" size="small" onPress={() => handleCopy(10)} />
      <Button style={style} text="Copier 20 messages" color="brand" size="small" onPress={() => handleCopy(20)} />
      <Button style={style} text="Copier 30 messages" color="brand" size="small" onPress={() => handleCopy(30)} />
      <Button style={style} text="Copier 40 messages" color="brand" size="small" onPress={() => handleCopy(40)} />
      <Button style={style} text="Copier 50 messages" color="brand" size="small" onPress={() => handleCopy(50)} />
    </ScrollView>
  );
}
