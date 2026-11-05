from fastapi import APIRouter, Depends, HTTPException, Response
from pymongo import ReturnDocument

from lib.auth import current_user
from lib.db import db
from models.template import Template, TemplateIn

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[Template])
async def list_templates(user: dict = Depends(current_user)):
    docs = await db.templates.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [Template(**d) for d in docs]


@router.post("", response_model=Template, status_code=201)
async def create_template(body: TemplateIn, user: dict = Depends(current_user)):
    t = Template(**body.model_dump())
    await db.templates.insert_one({**t.model_dump(), "user_id": user["id"]})
    return t


@router.put("/{id}", response_model=Template)
async def update_template(id: str, body: TemplateIn, user: dict = Depends(current_user)):
    doc = await db.templates.find_one_and_update(
        {"id": id, "user_id": user["id"]},
        {"$set": body.model_dump()},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return Template(**doc)


@router.delete("/{id}", status_code=204)
async def delete_template(id: str, user: dict = Depends(current_user)):
    res = await db.templates.delete_one({"id": id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(status_code=204)
