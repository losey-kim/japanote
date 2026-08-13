import { handleChallengePreviewImageRequest } from "../../../functions/challenge-preview/shared.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const response = await handleChallengePreviewImageRequest(url, req.query.code, {});
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}
