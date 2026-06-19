import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DocType = 'privacy' | 'terms';

const PRIVACY_POLICY_TEXT = `**Last updated: June 2026**

Hidden Gems ("we," "our," or "us") respects your privacy. This Privacy Policy explains what information we collect, how we use it, and the choices you have. It applies to the Hidden Gems mobile application and any related services (together, the "Service").

By using Hidden Gems, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use the Service.

## 1. Information We Collect

### 1.1 Information you provide directly
- **Account information**: email address, username, password (encrypted), and optional profile photo
- **Profile details**: home town, bio, language and theme preferences
- **Content you create**: pins ("gems"), photos, descriptions, comments, ratings, likes, messages, and community posts
- **Communications**: messages you send to other users or to us (e.g. support requests, reports)

### 1.2 Information collected automatically
- **Location data**: with your permission, we collect your device's GPS location to show nearby gems, verify visits, suggest a "Local's Pick" badge, and let you drop a pin at your current location. You can disable location sharing on the map at any time in-app, and you can revoke location permissions at the OS level.
- **Usage data**: pages and screens viewed, features used, search queries, session length, and app interactions
- **Device information**: device model, operating system version, unique device identifiers, and crash/diagnostic logs
- **Approximate location from IP address** for general analytics purposes

### 1.3 Information from third parties
- If you choose to sign in with Google or Apple, we receive your name and email address from that provider, as permitted by your account settings with them.

## 2. How We Use Your Information

We use the information we collect to:
- Operate, maintain, and improve the Service
- Show you relevant gems, recommendations, and a personalized feed based on your preferences and location
- Verify that a gem was created or visited at the claimed location ("verified visit")
- Enable social features such as following, messaging, comments, likes, and communities
- Send you notifications about activity relevant to you (likes, comments, follows, messages) — you can manage these in Settings
- Detect, investigate, and prevent fraud, abuse, spam, and violations of our Terms of Service
- Process payments and manage subscriptions (Premium plans)
- Communicate with you about updates, security alerts, and support matters
- Comply with legal obligations

We do **not** sell your personal information.

## 3. How We Share Your Information

We may share information in the following circumstances:

- **With other users**: your username, profile photo, public gems, comments, likes, and follower/following lists are visible to other users according to your privacy settings. Liked and visited gems are only visible to others if you choose to make them public in your profile settings.
- **Service providers**: we use third-party providers to operate the Service, including Supabase (database, authentication, file storage), Apple App Store / Google Play (app distribution and in-app purchases), RevenueCat (subscription management, once integrated), and email delivery providers.
- **Legal reasons**: if required by law, subpoena, or to protect the rights, property, or safety of Hidden Gems, our users, or the public
- **Business transfers**: if Hidden Gems is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.

We do not share your precise location with other users. Other users only see the location of gems you choose to make public, not your real-time position.

## 4. Your Privacy Choices and Rights

### 4.1 In-app controls
- Make your profile private (only approved followers can see your content)
- Make your Liked Gems and Visited Gems public or private independently
- Hide your live location dot on the map
- Block or report other users, gems, comments, or messages
- Delete individual gems, comments, or your account at any time

### 4.2 Your rights under GDPR (European users)
If you are located in the European Economic Area, UK, or Switzerland, you have the right to access, correct, delete, restrict, or object to processing of your data, receive a portable copy, withdraw consent, and lodge a complaint with your local data protection authority.

### 4.3 Your rights under CCPA/CPRA (California users)
If you are a California resident, you have the right to know what personal information we collect, request deletion or correction, opt out of sale/sharing (we do not sell personal information), and not be discriminated against for exercising these rights.

### 4.4 Exercising your rights
To exercise any of these rights, contact us at **support@hiddengems.app**. We will respond within the timeframe required by applicable law. You can also delete your account directly from Settings → Delete Account.

## 5. Data Retention

We retain your information for as long as your account is active or as needed to provide the Service. If you delete your account, we delete or anonymize your personal data within 30 days, except where we are required to retain it for legal, security, or fraud-prevention purposes. Public content you posted (such as gems) may remain visible if other users have interacted with it, but will no longer be attributed to your identity.

## 6. Data Security

We use industry-standard security measures, including encryption in transit and at rest, row-level access controls, and restricted internal access, to protect your information. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.

## 7. Children's Privacy

Hidden Gems is not directed to children under 16, and we do not knowingly collect personal information from children under 16. If we learn that we have collected such information, we will delete it promptly. If you believe a child has provided us with personal information, please contact us.

## 8. International Data Transfers

Your information may be transferred to, stored, and processed in countries other than your own, including the United States and the European Union, where our service providers operate. We rely on appropriate safeguards, such as Standard Contractual Clauses, for these transfers where required by law.

## 9. Third-Party Links and Services

The Service may contain links to third-party websites or integrate third-party services (such as map providers or payment processors). We are not responsible for the privacy practices of those third parties. We encourage you to review their privacy policies.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the app or by email before the changes take effect. The "Last updated" date at the top reflects the most recent revision.

## 11. Contact Us

If you have questions about this Privacy Policy or how we handle your data, contact us at:

**Email:** support@hiddengems.app`;

const TERMS_OF_SERVICE_TEXT = `**Last updated: June 2026**

Welcome to Hidden Gems. These Terms of Service ("Terms") govern your access to and use of the Hidden Gems mobile application and related services (the "Service"), operated by Hidden Gems ("we," "our," or "us").

By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

## 1. Eligibility

You must be at least 16 years old to use Hidden Gems. By using the Service, you represent that you meet this requirement and that you have the legal capacity to enter into these Terms. If you are using the Service on behalf of a minor under your supervision, you are responsible for their compliance with these Terms.

## 2. Your Account

- You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.
- You must provide accurate information when creating your account and keep it up to date.
- You may not create an account for someone else without their permission, impersonate any person or entity, or create multiple accounts to evade restrictions or bans.
- We reserve the right to suspend or terminate accounts that violate these Terms.

## 3. User Content

### 3.1 Your content
"User Content" means any gems, photos, descriptions, comments, ratings, messages, community posts, or other material you submit to the Service. You retain ownership of your User Content. By posting User Content, you grant us a non-exclusive, worldwide, royalty-free, sublicensable license to host, store, reproduce, display, and distribute it as necessary to operate and promote the Service.

### 3.2 Your responsibilities
You are solely responsible for your User Content. You agree that your User Content will not be false or misleading, infringe third-party rights, contain hate speech or harassment, contain explicit or exploitative material, promote illegal activity, contain spam or malware, or violate any applicable law.

### 3.3 Moderation
We may review, remove, or restrict access to any User Content, and suspend or terminate accounts, at our discretion, if we believe it violates these Terms or harms the Service, other users, or third parties. You can report content or users using the in-app reporting tools.

### 3.4 Location accuracy
Hidden Gems uses location verification to encourage accurate pin placement. However, we do not guarantee the accuracy, safety, or legality of any location, gem, or activity suggested by other users. Always exercise your own judgment and follow local laws when visiting any location.

## 4. Community Guidelines

When using social features (following, messaging, comments, communities), you agree to treat other users with respect, not harass or threaten others, not use the Service to coordinate illegal access to private property, and respect the privacy choices of others. Violation may result in content removal, account suspension, or termination.

## 5. Subscriptions and Payments

### 5.1 Free and Premium tiers
Hidden Gems offers a free tier with limited features and a Premium subscription (monthly, yearly, or lifetime) that unlocks additional features as described in the app.

### 5.2 Billing
- Subscriptions are billed through the Apple App Store or Google Play and are subject to their respective terms.
- Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
- Free trial periods, where offered, convert to a paid subscription automatically unless cancelled before the trial ends.

### 5.3 Lifetime offer
The Lifetime Premium offer is a one-time, non-recurring purchase. **Lifetime purchases are final and non-refundable**, except where required by applicable law or app store policy.

### 5.4 Refunds
Refund requests for subscriptions are handled by Apple or Google according to their respective refund policies. We do not directly process refunds for purchases made through app stores.

## 6. Intellectual Property

The Service, including its design, branding, logos, and underlying software, is owned by Hidden Gems and protected by intellectual property laws. These Terms do not grant you any rights to our trademarks, logos, or branding.

## 7. Termination

You may delete your account at any time through Settings. We may suspend or terminate your access to the Service, with or without notice, if we reasonably believe you have violated these Terms, created risk or legal exposure for us, or for any other reason at our discretion.

Upon termination, your right to use the Service ends immediately. Sections of these Terms that by their nature should survive termination will continue to apply.

## 8. Disclaimers

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY CONTENT, GEM, OR LOCATION SHARED BY USERS IS ACCURATE OR SAFE.

YOU USE THE SERVICE, AND VISIT ANY LOCATION DISCOVERED THROUGH THE SERVICE, AT YOUR OWN RISK.

## 9. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, HIDDEN GEMS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US, IF ANY, IN THE 12 MONTHS PRECEDING THE CLAIM.

## 10. Indemnification

You agree to indemnify and hold harmless Hidden Gems, its officers, employees, and agents from any claims, damages, or expenses arising from your use of the Service, your User Content, or your violation of these Terms.

## 11. Governing Law and Disputes

These Terms are governed by applicable law without regard to conflict-of-law principles. Any disputes arising from these Terms or the Service will be resolved according to the laws and courts applicable to your jurisdiction, unless consumer protection law in your country grants you the right to bring a claim locally.

## 12. Changes to These Terms

We may update these Terms from time to time. If we make material changes, we will notify you through the app or by email before the changes take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.

## 13. Contact Us

Questions about these Terms can be sent to:

**Email:** support@hiddengems.app`;

function FormattedLine({ text, style, boldStyle }: { text: string; style: object; boldStyle: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text style={style}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={index} style={boldStyle}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function LegalBody({ text, theme }: { text: string; theme: Theme }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const lines = text.split('\n');

  return (
    <View style={styles.body}>
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed === '---') {
          return <View key={index} style={styles.spacer} />;
        }

        if (trimmed.startsWith('## ')) {
          return (
            <Text key={index} style={styles.sectionHeading}>
              {trimmed.slice(3)}
            </Text>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <Text key={index} style={styles.subheading}>
              {trimmed.slice(4)}
            </Text>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <View key={index} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <FormattedLine
                text={trimmed.slice(2)}
                style={styles.bulletText}
                boldStyle={styles.bold}
              />
            </View>
          );
        }

        return (
          <FormattedLine
            key={index}
            text={trimmed}
            style={styles.paragraph}
            boldStyle={styles.bold}
          />
        );
      })}
    </View>
  );
}

export default function LegalDocumentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { type } = useLocalSearchParams<{ type?: string }>();

  const docType: DocType = type === 'terms' ? 'terms' : 'privacy';
  const title = docType === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const content = docType === 'privacy' ? PRIVACY_POLICY_TEXT : TERMS_OF_SERVICE_TEXT;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LegalBody text={content} theme={theme} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 22,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    body: {
      gap: 0,
    },
    spacer: {
      height: 8,
    },
    sectionHeading: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      marginTop: 20,
      marginBottom: 8,
    },
    subheading: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginTop: 12,
      marginBottom: 6,
    },
    paragraph: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 6,
      paddingLeft: 4,
    },
    bulletDot: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.textSecondary,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 21,
      color: theme.textSecondary,
    },
    bold: {
      fontWeight: '600',
      color: theme.text,
    },
  });
}
