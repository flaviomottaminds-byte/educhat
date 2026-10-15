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
export const sendDesktopNotification = (senderName, messageText) => {
  if (typeof window === 'undefined') return;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const cleanText = messageText && messageText.length > 90
        ? messageText.slice(0, 87) + '...'
        : messageText || 'Nova mensagem recebida';

      const notification = new Notification(`EduChat • ${senderName}`, {
        body: cleanText,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'educhat_msg',
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
export const startTaskbarBlink = (senderName) => {
  if (typeof window === 'undefined') return;

  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }

  let toggle = false;
  blinkInterval = setInterval(() => {
    toggle = !toggle;
    document.title = toggle
      ? `🔔 NOVA MENSAGEM de ${senderName.split(' ')[0]}!`
      : `💬 EduChat WhatsApp`;
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

// 5. Função Unificada: toca som, exibe toast nativo do Windows e pisca a barra
export const notifyIncomingMessage = (senderName, text) => {
  sendDesktopNotification(senderName, text);
  startTaskbarBlink(senderName);
};
