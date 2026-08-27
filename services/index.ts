/**
 * Services barrel export.
 * All server-side data access functions, grouped by domain.
 *
 * Import example:
 *   import { getFeaturedDesigns, getCategories } from '@/services';
 */
export {
  getFeaturedDesigns,
  getDesignBySlug,
  getDesignsByCreator,
  getPublishedDesigns,
  getMyDesigns,
  createDraftDesign,
  updateDraftDesign,
  submitDesignForReview,
  getCategories,
  FALLBACK_DESIGNS,
  FALLBACK_CATEGORIES,
} from './design.service';

export {
  getCreatorByHandle,
  getCreatorByUserId,
  getApprovedCreators,
  getCreatorStats,
  getMyCreatorApplication,
  applyToBeCreator,
  updateCreatorProfile,
} from './creator.service';

export {
  getReviewsByDesign,
} from './review.service';

export {
  getUserProfile,
  updateUserProfile,
} from './user-profile.service';

export {
  getDesignMedia,
  getMediaAsset,
  createMediaAssetRecord,
  updateMediaAsset,
  deleteMediaAsset,
  getOwnDesignMedia,
  getCreatorMediaStats,
  verifyMediaOwnership,
  resolveAuthenticatedCreatorId,
  buildStoragePath,
  parseStoragePath,
  sanitiseFilename,
  validateMediaFile,
  DESIGNS_BUCKET,
  UPLOAD_CONSTRAINTS,
} from './media.service';

export {
  getDashboardCreator,
  getCreatorDashboardStats,
  getCreatorDesignSummary,
  getCreatorDashboardData,
} from './dashboard.service';

export {
  createDesignDraft,
  updateDesignDraft,
  uploadDesignMedia,
  getDesignEditorData,
} from './design-creation.service';

// ── Phase 8: Media Pipeline ────────────────────────────────────────────────

export {
  processDesignMedia,
  generatePreview,
  generateThumbnail,
  extractImageMetadata,
  findDuplicateByChecksum,
  getDesignMediaProcessingStatus,
  scaleDimensions,
  PREVIEW_MAX_PX,
  THUMBNAIL_MAX_PX,
} from './media-processing.service';

// ── Phase 9: Media Processing Queue ───────────────────────────────────────

export {
  queueMediaProcessing,
  createProcessingJob,
  getProcessingStatus,
  retryFailedProcessing,
  cancelProcessingJob,
  appendProcessingLog,
} from './media-queue.service';

export {
  getSignedMediaUrl,
  getCreatorPreviewUrl,
  getMarketplaceThumbnailUrl,
  getDesignMediaUrls,
  getOriginalFileUrl,
  isSignedUrlValid,
  SIGNED_URL_EXPIRY_ORIGINAL,
  SIGNED_URL_EXPIRY_PREVIEW,
  SIGNED_URL_EXPIRY_THUMBNAIL,
} from './media-url.service';

export {
  getPublicDesignMedia,
  batchGetPublicDesignMedia,
  getCreatorDesignMediaStatus,
  isDesignReadyForReview,
} from './design-media.service';

export {
  getDesignCategories,
  addDesignCategory,
  removeDesignCategory,
  setDesignCategories,
  getDesignTags,
  addDesignTag,
  removeDesignTag,
  setDesignTags,
  setDesignMetadata,
} from './design-metadata.service';

export {
  getMyCollections,
  getCollectionWithItems,
  createCollection,
  addDesignToCollection,
  removeDesignFromCollection,
  getCollectionsContainingDesign,
  getPublicCollection,
} from './collection.service';
export type { PublicCollectionResult } from './collection.service';

// ── Phase 11: CDN Delivery & Public Media Layer ────────────────────────────

export {
  getPublicThumbnailUrl,
  getPublicPreviewUrl,
  getCreatorOriginalUrl,
  getDesignPublicMedia,
  batchGetDesignPublicMedia,
  PUBLIC_BUCKET,
} from './media-delivery.service';
