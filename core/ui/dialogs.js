import { showModal } from '../windows/modal.js';

export class DialogService {
  alert(title, message) {
    return showModal({
      title,
      content: message,
      actions: [
        {
          label: 'OK',
          primary: true
        }
      ]
    });
  }

  confirm(title, message) {
    return new Promise((resolve) => {
      showModal({
        title,
        content: message,
        actions: [
          {
            label: 'Cancel',
            onClick: () => resolve(false)
          },
          {
            label: 'OK',
            primary: true,
            onClick: () => resolve(true)
          }
        ]
      });
    });
  }

  error(message, title = 'Error') {
    return this.alert(title, message);
  }

  info(message, title = 'Information') {
    return this.alert(title, message);
  }
}