import type { Language } from '@/common/types/language';

/** Mail is written in the app's two UI languages; anything else gets English. */
type MailLanguage = 'en' | 'uk';
const mailLanguage = (lang: Language): MailLanguage => (lang === 'uk' ? 'uk' : 'en');

export interface MailContent {
  subject: string;
  text: string;
}

type Template = (link: string) => MailContent;

const templates: Record<'verifyEmail' | 'confirmEmailChange', Record<MailLanguage, Template>> = {
  verifyEmail: {
    en: (link) => ({
      subject: 'Confirm your email — Graph Resolver',
      text: `Confirm your email address to unlock your free daily algorithm runs:\n\n${link}\n\nThe link is valid for 24 hours. If you did not create an account, ignore this email.`,
    }),
    uk: (link) => ({
      subject: 'Підтвердіть email — Graph Resolver',
      text: `Підтвердіть адресу email, щоб отримати безкоштовні щоденні запуски алгоритмів:\n\n${link}\n\nПосилання дійсне 24 години. Якщо ви не створювали акаунт, просто проігноруйте цей лист.`,
    }),
  },
  confirmEmailChange: {
    en: (link) => ({
      subject: 'Confirm your new email — Graph Resolver',
      text: `Someone (hopefully you) asked to use this address for a Graph Resolver account. Confirm the change:\n\n${link}\n\nThe link is valid for 24 hours. If it was not you, ignore this email.`,
    }),
    uk: (link) => ({
      subject: 'Підтвердіть нову адресу email — Graph Resolver',
      text: `Хтось (сподіваємось, ви) хоче використовувати цю адресу для акаунта Graph Resolver. Підтвердіть зміну:\n\n${link}\n\nПосилання дійсне 24 години. Якщо це були не ви, проігноруйте лист.`,
    }),
  },
};

const emailChangedNotice: Record<MailLanguage, (newEmail: string) => MailContent> = {
  en: (newEmail) => ({
    subject: 'Your email was changed — Graph Resolver',
    text: `The email of your Graph Resolver account was changed to ${newEmail}. If this was not you, contact support right away.`,
  }),
  uk: (newEmail) => ({
    subject: 'Email вашого акаунта змінено — Graph Resolver',
    text: `Email вашого акаунта Graph Resolver змінено на ${newEmail}. Якщо це були не ви, негайно зверніться до підтримки.`,
  }),
};

export function linkMail(kind: keyof typeof templates, lang: Language, link: string): MailContent {
  return templates[kind][mailLanguage(lang)](link);
}

export function emailChangedMail(lang: Language, newEmail: string): MailContent {
  return emailChangedNotice[mailLanguage(lang)](newEmail);
}
