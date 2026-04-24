from fastapi import APIRouter, Depends, HTTPException, Query, status

from munch_catering_backend.database import get_db
from munch_catering_backend.dependencies import get_current_principal
from munch_catering_backend.models import (
    ConversationListResponse,
    ConversationSummary,
    MessageCreate,
    MessageResponse,
    MessageThreadResponse,
    Principal,
    UnreadCountResponse,
)
from munch_catering_backend.time_utils import utc_now
from munch_catering_backend.utils import clamp_pagination, parse_object_id

router = APIRouter(prefix="/messages", tags=["Messages"])


def serialize_message(document: dict) -> MessageResponse:
    return MessageResponse(
        id=str(document["_id"]),
        sender=document["sender"],
        recipient=document["recipient"],
        content=document["content"],
        timestamp=document["timestamp"],
        is_read=document.get("is_read", False),
    )


async def ensure_user_exists(email: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    limit: int = Query(default=25, ge=1),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    messages = await db.messages.find(
        {"$or": [{"sender": principal.email}, {"recipient": principal.email}]}
    ).sort("timestamp", -1).to_list(None)

    summaries: dict[str, ConversationSummary] = {}
    for message in messages:
        contact_email = message["recipient"] if message["sender"] == principal.email else message["sender"]
        if contact_email in summaries:
            if message["recipient"] == principal.email and not message.get("is_read", False):
                summaries[contact_email].unread_count += 1
            continue

        contact = await db.users.find_one({"email": contact_email}, {"full_name": 1, "username": 1})
        contact_name = (
            (contact or {}).get("full_name")
            or (contact or {}).get("username")
            or contact_email
        )
        summaries[contact_email] = ConversationSummary(
            id=contact_email,
            contact_email=contact_email,
            contact_name=contact_name,
            preview=message["content"][:120],
            unread_count=1 if message["recipient"] == principal.email and not message.get("is_read", False) else 0,
            timestamp=message["timestamp"],
        )

    ordered = list(summaries.values())
    sliced = ordered[offset : offset + limit]
    return ConversationListResponse(items=sliced, total=len(ordered), limit=limit, offset=offset)


@router.get("/thread/{contact_email}", response_model=MessageThreadResponse)
async def get_thread(
    contact_email: str,
    limit: int = Query(default=50, ge=1),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    limit, offset = clamp_pagination(limit, offset)
    await ensure_user_exists(contact_email)
    query = {
        "$or": [
            {"sender": principal.email, "recipient": contact_email},
            {"sender": contact_email, "recipient": principal.email},
        ]
    }
    total = await db.messages.count_documents(query)
    documents = await db.messages.find(query).sort("timestamp", 1).skip(offset).limit(limit).to_list(limit)
    items = [serialize_message(document) for document in documents]
    return MessageThreadResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message: MessageCreate,
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    if message.recipient == principal.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot send a message to yourself")

    await ensure_user_exists(message.recipient)
    document = {
        "sender": principal.email,
        "recipient": message.recipient,
        "content": message.content.strip(),
        "timestamp": utc_now(),
        "is_read": False,
    }
    result = await db.messages.insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_message(document)


@router.put("/{message_id}/read")
async def mark_message_as_read(
    message_id: str,
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    result = await db.messages.find_one_and_update(
        {"_id": parse_object_id(message_id, "Invalid message id"), "recipient": principal.email},
        {"$set": {"is_read": True, "read_at": utc_now()}},
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return {"message": "Message marked as read"}


@router.put("/conversations/{contact_email}/read")
async def mark_conversation_as_read(
    contact_email: str,
    principal: Principal = Depends(get_current_principal),
):
    db = get_db()
    result = await db.messages.update_many(
        {"sender": contact_email, "recipient": principal.email, "is_read": False},
        {"$set": {"is_read": True, "read_at": utc_now()}},
    )
    return {"message": f"Marked {result.modified_count} messages as read"}


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(principal: Principal = Depends(get_current_principal)):
    db = get_db()
    count = await db.messages.count_documents({"recipient": principal.email, "is_read": False})
    return UnreadCountResponse(unread_count=count)
