import { showModal } from '../windows/modal.js';

export function alertDialog(title, message) {
  return showModal({
    title,
    content: message,
    actions: [{ label: 'OK', primary: true }]
  });
}
