import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";
import { getAssetDiskPath, getAssetURL, mediaTypeToExt } from "./assets";

const MAX_UPLOAD_SIZE = 10 << 20;

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File))
    throw new BadRequestError("Data is not a file!");

  if (file.size > MAX_UPLOAD_SIZE)
    throw new BadRequestError("File size is larger than 10MB!");

  const fileMediaType = file.type;
  if (!fileMediaType) 
    throw new BadRequestError("Missing Content-Type for thumbnail");
  

  const video = getVideo(cfg.db, videoId);

  if (!video)
    throw new NotFoundError("Video not found!");

  if (video.userID !== userID)
    throw new UserForbiddenError("UnAuthorized!");

  const ext = mediaTypeToExt(fileMediaType);
  const filename = `${videoId}${ext}`;

  const assetDiskPath = getAssetDiskPath(cfg, filename);
  await Bun.write(assetDiskPath, file);

  const urlPath = getAssetURL(cfg, filename);
  video.thumbnailURL = urlPath;
  updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
