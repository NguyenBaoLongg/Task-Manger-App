import * as Notifications from 'expo-notifications';

export const configureNotificationCategories = async () => {
  await Notifications.setNotificationCategoryAsync('BOOKING_ACTIONS', [
    { identifier: 'ARRIVED_PROOF', buttonTitle: 'Đã đến', options: { opensAppToForeground: true } },
    {
      identifier: 'CANCEL_OR_RESCHEDULE',
      buttonTitle: 'Hủy/Rời lịch',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
};
