import { ObjectId } from "mongodb";
import { getObjectsDb } from "../db.js";

const addImageLink = async (
  objectId: string,
  imageId: string,
  userFolder: string
) => {
  const db = getObjectsDb();
  const data = await db
    .collection(userFolder)
    .findOne({ _id: new ObjectId(objectId) });

  if (!data) {
    return "";
  }

  data.images.push(imageId);

  const updateObject = { $set: { images: data.images } };
  const attempt = await db
    .collection(userFolder)
    .updateOne({ _id: new ObjectId(objectId) }, updateObject);

  if (attempt.matchedCount === 0) {
    return "";
  }

  return objectId;
};

export default addImageLink;
