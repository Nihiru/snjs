import { ContentType } from './../models/content_types';
import { PayloadSource } from './../protocol/payloads/sources';
import { RawPayload } from '../protocol/payloads/generator';
import { ItemManager } from './item_manager';
import { SNNote } from './../models/app/note';
import { SNTheme } from './../models/app/theme';
import { SNItem } from '../models/core/item';
import { SNAlertService } from './alert_service';
import { SNSyncService } from './sync/sync_service';
import { PureService } from './pure_service';
import { ComponentArea, SNComponent, ComponentAction, ComponentPermission } from '../models/app/component';
import { Platform, Environment } from '../platforms';
import { UuidString } from '../types';
declare type ComponentHandler = {
    identifier: string;
    areas: ComponentArea[];
    actionHandler?: (component: SNComponent, action: ComponentAction, data: MessageData) => void;
    contextRequestHandler?: (componentUuid: UuidString) => SNItem | undefined;
    componentForSessionKeyHandler?: (sessionKey: string) => SNComponent | undefined;
    focusHandler?: (component: SNComponent, focused: boolean) => void;
};
export declare type PermissionDialog = {
    component: SNComponent;
    permissions: ComponentPermission[];
    permissionsString: string;
    actionBlock: (approved: boolean) => void;
    callback: (approved: boolean) => void;
};
declare type MessageData = Partial<{
    content_types: ContentType[];
    item: RawPayload & {
        clientData: any;
    };
    items: (RawPayload & {
        clientData: any;
    })[];
    permissions: ComponentPermission[];
    componentData: any;
    uuid: UuidString;
    environment: string;
    platform: string;
    activeThemeUrls: string[];
    width: string | number;
    height: string | number;
    /** Related to setSize action */
    type: 'container';
}>;
declare type ComponentMessage = {
    action: ComponentAction;
    sessionKey?: string;
    componentData?: any;
    data: MessageData;
};
declare type MessageReplyData = {
    approved?: boolean;
    deleted?: boolean;
    error?: string;
    item?: any;
    items?: any[];
    themes?: string[];
};
declare type MessageReply = {
    action: ComponentAction;
    original: ComponentMessage;
    data: MessageReplyData;
};
declare type ItemMessagePayload = {
    uuid: string;
    content_type: ContentType;
    created_at: Date;
    updated_at: Date;
    deleted: boolean;
    content: any;
    clientData: any;
    /** isMetadataUpdate implies that the extension should make reference of updated
    * metadata, but not update content values as they may be stale relative to what the
    * extension currently has. Changes are always metadata updates if the mapping source
    * is PayloadSource.RemoteSaved || PayloadSource.LocalSaved || PayloadSource.PreSyncSave */
    isMetadataUpdate: any;
};
declare type ComponentState = {
    window?: Window;
    hidden: boolean;
    readonly: boolean;
    lockReadonly: boolean;
    sessionKey?: string;
};
/**
 * Responsible for orchestrating component functionality, including editors, themes,
 * and other components. The component manager primarily deals with iframes, and orchestrates
 * sending and receiving messages to and from frames via the postMessage API.
 */
export declare class SNComponentManager extends PureService {
    private itemManager;
    private syncService;
    protected alertService: SNAlertService;
    private environment;
    private platform;
    private timeout;
    private desktopManager;
    private componentState;
    private removeItemObserver?;
    private streamObservers;
    private contextStreamObservers;
    private permissionDialogs;
    private handlers;
    private templateComponents;
    constructor(itemManager: ItemManager, syncService: SNSyncService, alertService: SNAlertService, environment: Environment, platform: Platform, timeout: any);
    get isDesktop(): boolean;
    get isMobile(): boolean;
    get components(): SNComponent[];
    componentsForArea(area: ComponentArea): SNComponent[];
    /** @override */
    deinit(): void;
    setDesktopManager(desktopManager: any): void;
    configureForGeneralUsage(): void;
    notifyStreamObservers(allItems: SNItem[], source?: PayloadSource, sourceKey?: string): void;
    isNativeExtension(component: SNComponent): boolean;
    detectFocusChange: () => void;
    onWindowMessage: (event: MessageEvent) => void;
    configureForNonMobileUsage(): void;
    configureForDesktop(): void;
    postActiveThemesToAllComponents(): void;
    getActiveThemes(): SNTheme[];
    urlsForActiveThemes(): string[];
    postActiveThemesToComponent(component: SNComponent): void;
    private findComponent;
    addTemporaryTemplateComponent(component: SNComponent): void;
    removeTemporaryTemplateComponent(component: SNComponent): void;
    contextItemDidChangeInArea(area: ComponentArea): void;
    isComponentHidden(component: SNComponent): boolean;
    setComponentHidden(component: SNComponent, hidden: boolean): void;
    jsonForItem(item: SNItem, component: SNComponent, source?: PayloadSource): ItemMessagePayload;
    sendItemsInReply(componentUuid: UuidString, items: SNItem[], message: ComponentMessage, source?: PayloadSource): void;
    sendContextItemInReply(componentUuid: UuidString, item: SNItem, originalMessage: ComponentMessage, source?: PayloadSource): void;
    replyToMessage(component: SNComponent, originalMessage: ComponentMessage, replyData: MessageReplyData): void;
    sendMessageToComponent(component: SNComponent, message: ComponentMessage | MessageReply): void;
    urlForComponent(component: SNComponent): string | null;
    componentForUrl(url: string): SNComponent;
    sessionKeyForComponent(component: SNComponent): string | undefined;
    componentForSessionKey(key: string): SNComponent | undefined;
    handleMessage(component: SNComponent, message: ComponentMessage): void;
    removePrivatePropertiesFromResponseItems<T extends RawPayload>(responseItems: T[], component: SNComponent, includeUrls?: boolean): T[];
    handleStreamItemsMessage(component: SNComponent, message: ComponentMessage): void;
    handleStreamContextItemMessage(component: SNComponent, message: ComponentMessage): void;
    isItemIdWithinComponentContextJurisdiction(uuid: string, component: SNComponent): boolean;
    itemIdsInContextJurisdictionForComponent(component: SNComponent): string[];
    handlersForArea(area: ComponentArea): ComponentHandler[];
    handleSaveItemsMessage(component: SNComponent, message: ComponentMessage): Promise<void>;
    handleDuplicateItemMessage(component: SNComponent, message: ComponentMessage): void;
    handleCreateItemsMessage(component: SNComponent, message: ComponentMessage): void;
    handleDeleteItemsMessage(component: SNComponent, message: ComponentMessage): void;
    handleRequestPermissionsMessage(component: SNComponent, message: ComponentMessage): void;
    handleSetComponentDataMessage(component: SNComponent, message: ComponentMessage): void;
    handleToggleComponentMessage(targetComponent: SNComponent): Promise<void>;
    toggleComponent(component: SNComponent): Promise<void>;
    handleInstallLocalComponentMessage(sourceComponent: SNComponent, message: ComponentMessage): void;
    runWithPermissions(componentUuid: UuidString, requiredPermissions: ComponentPermission[], runFunction: () => void): void;
    promptForPermissions(component: SNComponent, permissions: ComponentPermission[], callback: (approved: boolean) => Promise<void>): void;
    presentPermissionsDialog(_dialog: PermissionDialog): void;
    openModalComponent(_component: SNComponent): void;
    registerHandler(handler: ComponentHandler): () => void;
    findOrCreateDataForComponent(componentUuid: UuidString): ComponentState;
    setReadonlyStateForComponent(component: SNComponent, readonly: boolean, lockReadonly?: boolean): void;
    getReadonlyStateForComponent(component: SNComponent): ComponentState;
    /** Called by other views when the iframe is ready */
    registerComponentWindow(component: SNComponent, componentWindow: Window): Promise<void>;
    activateComponent(uuid: UuidString): Promise<void>;
    /** Clients should call this function whenever a component iframe is destroyed */
    onComponentIframeDestroyed(uuid: UuidString): Promise<void>;
    /**
     * Deregistering means that our local state for this component will be wiped.
     * No synced data will be affected. This differs from `activating` in that activating
     * will mutate the component to change its synced property .active to true.
     */
    private deregisterComponent;
    deactivateComponent(uuid: UuidString): Promise<void>;
    deleteComponent(uuid: UuidString): Promise<void>;
    isComponentActive(component: SNComponent): boolean;
    allComponentIframes(): HTMLIFrameElement[];
    iframeForComponent(uuid: UuidString): HTMLIFrameElement | undefined;
    handleSetSizeEvent(component: SNComponent, data: MessageData): void;
    editorForNote(note: SNNote): SNComponent | undefined;
    getDefaultEditor(): SNComponent;
    permissionsStringForPermissions(permissions: ComponentPermission[], component: SNComponent): string;
}
export {};
