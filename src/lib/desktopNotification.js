// Gerenciador de Alertas no Windows, Notificações Nativas e Efeito Piscar na Barra de Tarefas

let blinkInterval = null;
const ORIGINAL_TITLE = 'EduChat';

// 1. Solicita permissão nativa para notificações no Windows/Navegador
export const requestDesktopNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.warn('Erro ao solicitar permissão de notificação desktop:', e);
      }
    }
  }
};

// 2. Dispara a notificação nativa do Windows (toast no canto inferior direito)
export const sendDesktopNotification = (senderNameOrTitle, messageText, options = {}) => {
  if (typeof window === 'undefined') return;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const cleanText = messageText && messageText.length > 90
        ? messageText.slice(0, 87) + '...'
        : messageText || 'Nova mensagem recebida';

      let notifTitle = `EduChat • ${senderNameOrTitle}`;
      if (options.isChannel && options.channelName) {
        notifTitle = `EduChat • #${options.channelName}`;
      } else if (options.isDm) {
        notifTitle = `EduChat • Mensagem Direta`;
      }

      const notifBody = options.isChannel && options.senderName
        ? `${options.senderName}: ${cleanText}`
        : cleanText;

      const notification = new Notification(notifTitle, {
        body: notifBody,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: options.tag || (options.channelName ? `educhat_ch_${options.channelName}` : 'educhat_msg'),
        renotify: true,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        stopTaskbarBlink();
      };
    } catch (err) {
      console.warn('Falha ao instanciar Notification:', err);
    }
  }
};

// 3. Efeito Piscar contínuo no Título da Aba (faz o ícone do Windows na barra de tarefas piscar em laranja)
export const startTaskbarBlink = (senderNameOrTitle, options = {}) => {
  if (typeof window === 'undefined') return;

  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }

  let blinkText = '';
  if (options.isChannel && options.channelName) {
    const sName = options.senderName ? options.senderName.split(' ')[0] : '';
    blinkText = sName ? `🔔 [#${options.channelName}] ${sName}` : `🔔 #${options.channelName}`;
  } else if (options.isDm) {
    const sName = (options.senderName || senderNameOrTitle || '').split(' ')[0];
    blinkText = `🔔 [DM] ${sName || 'Nova Mensagem'}!`;
  } else {
    const sName = (senderNameOrTitle || '').split(' ')[0];
    blinkText = `🔔 ${sName || 'Nova Mensagem'}!`;
  }

  let toggle = false;
  blinkInterval = setInterval(() => {
    toggle = !toggle;
    document.title = toggle
      ? blinkText
      : `💬 EduChat`;
  }, 1000);

  // Limpa o alerta assim que o usuário clicar na janela ou alternar a aba de volta
  const cleanup = () => {
    stopTaskbarBlink();
    window.removeEventListener('focus', cleanup);
    window.removeEventListener('click', cleanup);
    document.removeEventListener('visibilitychange', handleVisibility);
  };

  const handleVisibility = () => {
    if (!document.hidden) cleanup();
  };

  window.addEventListener('focus', cleanup);
  window.addEventListener('click', cleanup);
  document.addEventListener('visibilitychange', handleVisibility);
};

// 4. Parar de piscar
export const stopTaskbarBlink = () => {
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
  document.title = ORIGINAL_TITLE;
};

// 5. Função Unificada: exibe toast nativo do Windows e pisca a barra
export const notifyIncomingMessage = (senderNameOrTitle, text, options = {}) => {
  sendDesktopNotification(senderNameOrTitle, text, options);
  startTaskbarBlink(senderNameOrTitle, options);
};
