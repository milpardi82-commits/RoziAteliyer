/**
 * Domain type barrel export.
 * Import all types from here: import type { Design, Creator } from '@/types';
 */
export type { Creator, Shop, Design, Category, Collection, Review, Tag, DesignSortOption } from './marketplace';
export type { UserProfile, AuthUser } from './auth';
export type {
  CreatorStatus,
  CreatorApplicationStatus,
  CreatorApplication,
  CreatorApplicationInput,
  CreatorProfileUpdate,
  CreatorWithApplication,
  CreatorStats,
  PublicCreator,
} from './creator';
export type {
  DesignStatus,
  CollectionStatus,
  PublicDesign,
  CreateDraftDesignInput,
  UpdateDraftDesignInput,
  CollectionItem,
  CreateCollectionInput,
  PaginationParams,
  PaginatedResult,
  DesignFilterParams,
  DesignTag,
} from './design';
export type {
  MediaAsset,
  MediaAssetType,
  MediaAssetStatus,
  MediaVariant,
  PublicMediaAsset,
  CreateMediaAssetInput,
  UpdateMediaAssetInput,
  MediaUploadConstraints,
  MediaValidationResult,
  StoragePathComponents,
  DesignMediaSummary,
  MediaVariantMatrix,
  DesignPublicMedia,
  MediaDeliveryResult,
} from './media';
export type {
  CreatorDashboardStats,
  CreatorDesignSummary,
  CreatorDashboardData,
  DashboardDesignListParams,
  DashboardSection,
} from './dashboard';
export type {
  DesignCreationInput,
  DesignUpdateInput,
  DesignUploadResult,
  DesignUploadError,
  DesignEditorData,
  DesignEditorAsset,
  UploadProgressState,
} from './design-upload';
export type {
  ProcessingJobType,
  ProcessingJobStatus,
  MediaProcessingJob,
  CreateProcessingJobInput,
  DesignProcessingStatus,
  QueueProcessingResult,
  GetProcessingStatusResult,
  RetryProcessingResult,
  CancelJobResult,
} from './media-queue';
