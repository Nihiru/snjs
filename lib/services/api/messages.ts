import { KeyParamsOrigination, SNRootKeyParams } from './../../protocol/key_params';
import { ProtocolVersion } from '@Protocol/versions';
export const API_MESSAGE_GENERIC_INVALID_LOGIN = 'A server error occurred while trying to sign in. Please try again.';
export const API_MESSAGE_GENERIC_REGISTRATION_FAIL = 'A server error occurred while trying to register. Please try again.';
export const API_MESSAGE_GENERIC_CHANGE_PW_FAIL = `Something went wrong while changing your password. Your password was not changed. Please try again.`;
export const API_MESSAGE_GENERIC_SYNC_FAIL = 'Could not connect to server.';

export const API_MESSAGE_REGISTRATION_IN_PROGRESS = 'An existing registration request is already in progress.';
export const API_MESSAGE_LOGIN_IN_PROGRESS = 'An existing sign in request is already in progress.';
export const API_MESSAGE_CHANGE_PW_IN_PROGRESS = 'An existing change password request is already in progress.';

export const API_MESSAGE_FALLBACK_LOGIN_FAIL = 'Invalid email or password.';

export const API_MESSAGE_GENERIC_TOKEN_REFRESH_FAIL = `A server error occurred while trying to refresh your session. Please try again.`;

export const API_MESSAGE_TOKEN_REFRESH_IN_PROGRESS = `Your account session is being renewed with the server. Please try your request again.`;

export const API_MESSAGE_INVALID_SESSION = 'Please sign in to an account in order to continue with your request.';

export const UNSUPPORTED_PROTOCOL_VERSION = `This version of the application does not support your newer account type. Please upgrade to the latest version of Standard Notes to sign in.`;

export const EXPIRED_PROTOCOL_VERSION = `The protocol version associated with your account is outdated and no longer supported by this application. Please visit standardnotes.org/help/security for more information.`;

export const OUTDATED_PROTOCOL_VERSION = `The encryption version for your account is outdated and requires upgrade. You may proceed with login, but are advised to perform a security update using the web or desktop application. Please visit standardnotes.org/help/security for more information.`;

export const UNSUPPORTED_KEY_DERIVATION = `Your account was created on a platform with higher security capabilities than this browser supports. If we attempted to generate your login keys here, it would take hours. Please use a browser with more up to date security capabilities, like Google Chrome or Firefox, to log in.`;

export const INVALID_PASSWORD_COST = `Unable to login due to insecure password parameters. Please visit standardnotes.org/help/security for more information.`;
export const INVALID_PASSWORD = `Invalid password.`;

export const OUTDATED_PROTOCOL_ALERT_TITLE = 'Update Recommended';
export const OUTDATED_PROTOCOL_ALERT_IGNORE = 'Sign In';
export const UPGRADING_ENCRYPTION = `Upgrading your account's encryption version…`;

export const SETTING_PASSCODE = `Setting passcode…`;
export const CHANGING_PASSCODE = `Changing passcode…`;
export const REMOVING_PASSCODE = `Removing passcode…`;

export const DO_NOT_CLOSE_APPLICATION = 'Do not close the application until this process completes.';

export const UNKNOWN_ERROR = 'Unknown error.';

export function InsufficientPasswordMessage(minimum: number) {
  return `Your password must be at least ${minimum} characters in length. For your security, please choose a longer password or, ideally, a passphrase, and try again.`;
}

export function StrictSignInFailed(current: ProtocolVersion, latest: ProtocolVersion) {
  return `Strict Sign In has refused the server's sign-in parameters. The latest account version is ${latest}, but the server is reporting a version of ${current} for your account. If you'd like to proceed with sign in anyway, please disable Strict Sign In and try again.`;
}

export const UNSUPPORTED_BACKUP_FILE_VERSION = `This backup file was created using a newer version of the application and cannot be imported here. Please update your application and try again.`;
export const BACKUP_FILE_MORE_RECENT_THAN_ACCOUNT = `This backup file was created using a newer encryption version than your account's. Please run the available encryption upgrade and try again.`;

export const PasswordChangeStrings = {
  PasscodeRequired: 'Your passcode is required to process your password change.'
}

export const SignInStrings = {
  PasscodeRequired: 'Your passcode is required in order to sign in to your account.',
  IncorrectMfa: 'Incorrect two-factor authentication code. Please try again.',
  SignInCanceledMissingMfa: 'Your sign in request has been canceled.'
}

export const ProtocolUpgradeStrings = {
  SuccessAccount: "Your encryption version has been successfully upgraded. You may be asked to enter your credentials again on other devices you're signed into.",
  SuccessPasscodeOnly: "Your encryption version has been successfully upgraded.",
  Fail: "Unable to upgrade encryption version. Please try again.",
  UpgradingPasscode: 'Upgrading local encryption...'
}

export const KeyRecoveryStrings = {
  KeyRecoveryLoginFlowPrompt: (keyParams: SNRootKeyParams) => {
    const dateString = keyParams.createdDate?.toLocaleString();
    switch(keyParams.origination) {
      case KeyParamsOrigination.EmailChange:
        return `Enter your account password as it was when you changed your email on ${dateString}.`
      case KeyParamsOrigination.PasswordChange:
        return `Enter your account password after it was changed on ${dateString}.`
      case KeyParamsOrigination.Registration:
        return `Enter your account password as it was when you registered ${dateString}.`
      case KeyParamsOrigination.ProtocolUpgrade:
        return `Enter your account password as it was when you upgraded your encryption version on ${dateString}.`
      case KeyParamsOrigination.PasscodeChange:
        return `Enter your application passcode after it was changed on ${dateString}.`
      case KeyParamsOrigination.PasscodeCreate:
        return `Enter your application passcode as it was when you created it on ${dateString}.`
      default:
        throw Error('Unhandled KeyParamsOrigination case for KeyRecoveryLoginFlowPrompt');
    }
  },
  KeyRecoveryLoginFlowReason: 'Your account password is required to revalidate your session.',
  KeyRecoveryLoginFlowInvalidPassword: 'Incorrect credentials entered. Please try again.',
  KeyRecoveryRootKeyReplaced: 'Your credentials have successfully been updated.',
  KeyRecoveryPasscodeRequiredTitle: 'Passcode Required',
  KeyRecoveryPasscodeRequiredText: 'You must enter your passcode in order to save your new credentials.',
  KeyRecoveryPasswordRequired: 'Your account password is required to recover an encryption key.',
  KeyRecoveryKeyRecovered: 'Your key has successfully been recovered.',
  KeyRecoveryUnableToRecover: 'Unable to recover your key with the attempted password. Please try again.',
}

export const ChallengeModalTitle = {
  Generic: 'Authentication Required',
  Migration: 'Storage Update'
}

export const SessionStrings = {
  EnterEmailAndPassword: 'Please enter your account email and password.',
  RecoverSession(email: string) {
    return `Your credentials are needed for ${email} to refresh your session with the server.`;
  },
  SessionRestored: 'Your session has been successfully restored.',
  EnterMfa: 'Please enter your two-factor authentication code.',
  MfaInputPlaceholder: 'Two-factor authentication code',
  EmailInputPlaceholder: 'Email',
  PasswordInputPlaceholder: 'Password',
}

export const ChallengeStrings = {
  UnlockApplication: 'Authentication is required to unlock the application',
  EnterAccountPassword: 'Enter your account password',
  EnterLocalPasscode: 'Enter your application passcode',
  EnterPasscodeForMigration: 'Your application passcode is required to perform an upgrade of your local data storage structure.',
  EnterPasscodeForRootResave: 'Enter your application passcode to continue',
  EnterCredentialsForProtocolUpgrade: 'Enter your credentials to perform encryption upgrade',
  AccountPasswordPlaceholder: 'Account Password',
  LocalPasscodePlaceholder: 'Application Passcode',
}

export const PromptTitles = {
  AccountPassword: 'Account Password',
  LocalPasscode: 'Application Passcode',
  Biometrics: 'Biometrics',
}

