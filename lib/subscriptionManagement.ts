import { Linking, Platform } from 'react-native';

const IOS_SUBSCRIPTIONS_URL = 'itms-apps://apps.apple.com/account/subscriptions';
const ANDROID_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

export async function openSubscriptionManagement(): Promise<void> {
  const url = Platform.OS === 'ios' ? IOS_SUBSCRIPTIONS_URL : ANDROID_SUBSCRIPTIONS_URL;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return;
  }

  if (Platform.OS === 'android') {
    await Linking.openURL(ANDROID_SUBSCRIPTIONS_URL);
  }
}
