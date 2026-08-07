import prisma from '../../config/database';
import type { UpdateSettingsInput, UpdateSettingItem } from './settings.schema';

const DEFAULT_PUBLIC_SETTINGS: Record<string, any> = {
  storeName: 'PRC Hardware Enterprise',
  store_name: 'PRC Hardware Enterprise',
  storeEmail: 'contact@prchardware.com',
  store_email: 'contact@prchardware.com',
  storePhone: '+91 98765 43210',
  store_phone: '+91 98765 43210',
  storeAddress: '123 Industrial Area, Phase 2, Mumbai, Maharashtra 400001',
  store_address: '123 Industrial Area, Phase 2, Mumbai, Maharashtra 400001',
  currency: 'INR',
  logo: '/assets/logo.png',
  logo_url: '/assets/logo.png',
  socialLinks: {
    facebook: 'https://facebook.com/prchardware',
    twitter: 'https://twitter.com/prchardware',
    linkedin: 'https://linkedin.com/company/prchardware',
    instagram: 'https://instagram.com/prchardware',
  },
  social_links: {
    facebook: 'https://facebook.com/prchardware',
    twitter: 'https://twitter.com/prchardware',
    linkedin: 'https://linkedin.com/company/prchardware',
    instagram: 'https://instagram.com/prchardware',
  },
};

const parseSettingValue = (val: string) => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const serializeSettingValue = (val: unknown): string => {
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
};

export const getPublicSettings = async () => {
  const dbSettings = await prisma.setting.findMany({
    where: { isPublic: true },
  });

  const settingsMap: Record<string, any> = { ...DEFAULT_PUBLIC_SETTINGS };

  for (const s of dbSettings) {
    settingsMap[s.key] = parseSettingValue(s.value);
  }

  return settingsMap;
};

export const getAllSettings = async () => {
  const dbSettings = await prisma.setting.findMany({
    orderBy: [{ group: 'asc' }, { key: 'asc' }],
  });

  const settingsList = dbSettings.map((s) => ({
    id: s.id,
    key: s.key,
    value: parseSettingValue(s.value),
    group: s.group,
    description: s.description,
    isPublic: s.isPublic,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  const settingsMap: Record<string, any> = {};
  for (const s of settingsList) {
    settingsMap[s.key] = s.value;
  }

  return {
    settings: settingsMap,
    items: settingsList,
  };
};

export const updateSettings = async (input: UpdateSettingsInput) => {
  const itemsToUpdate: UpdateSettingItem[] = [];

  if (Array.isArray(input)) {
    itemsToUpdate.push(...input);
  } else {
    for (const [key, value] of Object.entries(input)) {
      itemsToUpdate.push({
        key,
        value,
      });
    }
  }

  for (const item of itemsToUpdate) {
    const serializedValue = serializeSettingValue(item.value);

    const isPublicDefault = [
      'storeName', 'store_name', 'storeEmail', 'store_email',
      'storePhone', 'store_phone', 'storeAddress', 'store_address',
      'currency', 'logo', 'logo_url', 'socialLinks', 'social_links'
    ].includes(item.key);

    const isPublic = item.isPublic !== undefined ? item.isPublic : isPublicDefault;

    await prisma.setting.upsert({
      where: { key: item.key },
      create: {
        key: item.key,
        value: serializedValue,
        group: item.group || 'GENERAL',
        description: item.description || null,
        isPublic,
      },
      update: {
        value: serializedValue,
        ...(item.group && { group: item.group }),
        ...(item.description !== undefined && { description: item.description }),
        ...(item.isPublic !== undefined && { isPublic: item.isPublic }),
      },
    });
  }

  return getAllSettings();
};
