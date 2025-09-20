from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from ..models.fee import Fee, FeeCreate, FeeUpdate, FeeResponse, FeeStatus, FeeSchedule
from ..models.property import Property
from ..models.user import User, UserRole
from ..routes.auth import get_current_user
from ..config.database import database

class GenerateFeesRequest(BaseModel):
    manual: bool = False
    year: Optional[int] = None
    months: Optional[List[int]] = None  # List of months (1-12)
    fee_schedule_ids: Optional[List[str]] = None  # List of fee schedule IDs

class PaginatedFeeResponse(BaseModel):
    data: List[FeeResponse]
    pagination: dict

router = APIRouter()

@router.get("/", response_model=PaginatedFeeResponse)
async def get_fees(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    property_id: Optional[str] = None
):
    # Build query filters
    query_filters = {}

    if current_user.role != UserRole.ADMIN:
        # Owners can only see their own fees
        query_filters["user.$id"] = PydanticObjectId(current_user.id)

    if year is not None:
        query_filters["year"] = year

    if month is not None:
        query_filters["month"] = month

    if status is not None:
        # Support multiple statuses separated by comma
        status_list = [s.strip() for s in status.split(',')]
        if len(status_list) == 1:
            query_filters["status"] = status_list[0]
        else:
            query_filters["status"] = {"$in": status_list}

    if property_id is not None:
        query_filters["property.$id"] = PydanticObjectId(property_id)

    # Get motor collection for aggregation
    fee_collection = database.fees

    # Get total count using aggregation
    count_pipeline = [{"$match": query_filters}, {"$count": "total"}]
    count_result = await fee_collection.aggregate(count_pipeline).to_list(length=1)
    total_count = count_result[0]["total"] if count_result else 0

    # Calculate skip
    skip = (page - 1) * limit

    # Aggregation pipeline for paginated results
    pipeline = [
        {"$match": query_filters},
        {"$lookup": {
            "from": "properties",
            "localField": "property.$id",
            "foreignField": "_id",
            "as": "property_data"
        }},
        {"$unwind": "$property_data"},
        {"$lookup": {
            "from": "fee_schedules",
            "localField": "fee_schedule.$id",
            "foreignField": "_id",
            "as": "fee_schedule_data"
        }},
        {"$unwind": "$fee_schedule_data"},
        {"$lookup": {
            "from": "users",
            "localField": "user.$id",
            "foreignField": "_id",
            "as": "user_data"
        }},
        {"$unwind": {"path": "$user_data", "preserveNullAndEmptyArrays": True}},
        {"$sort": {
            "year": -1,
            "month": -1,
            "property_data.row_letter": 1,
            "property_data.number": 1
        }},
        {"$skip": skip},
        {"$limit": limit}
    ]

    # Execute aggregation
    results = await fee_collection.aggregate(pipeline).to_list(length=None)

    # Calculate total pages
    total_pages = (total_count + limit - 1) // limit

    # Build fee responses from aggregated data
    fee_responses = []
    for result in results:
        paid_amount = result.get("paid_amount", 0.0)
        remaining_amount = result["amount"] - paid_amount

        fee_responses.append(FeeResponse(
            id=str(result["_id"]),
            property_id=str(result["property_data"]["_id"]),
            property_villa=result["property_data"]["villa"],
            property_row_letter=result["property_data"]["row_letter"],
            property_number=result["property_data"]["number"],
            property_owner_name=result["property_data"]["owner_name"],
            fee_schedule_id=str(result["fee_schedule_data"]["_id"]),
            user_id=str(result["user_data"]["_id"]) if result.get("user_data") else None,
            amount=result["amount"],
            paid_amount=paid_amount,
            remaining_amount=remaining_amount,
            generated_date=result["generated_date"],
            year=result["year"],
            month=result["month"],
            due_date=result["due_date"],
            status=result["status"],
            reference=result.get("reference"),
            notes=result.get("notes")
        ))

    return PaginatedFeeResponse(
        data=fee_responses,
        pagination={
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages
        }
    )

@router.get("/{fee_id}", response_model=FeeResponse)
async def get_fee(fee_id: str, current_user: User = Depends(get_current_user)):
    fee = await Fee.get(fee_id)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )

    # Fetch linked documents
    await fee.fetch_link(Fee.property)
    await fee.fetch_link(Fee.fee_schedule)
    if fee.user:
        await fee.fetch_link(Fee.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        (not fee.user or str(fee.user.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    return FeeResponse(
        id=str(fee.id),
        property_id=str(fee.property.id),
        property_villa=fee.property.villa,
        property_row_letter=fee.property.row_letter,
        property_number=fee.property.number,
        property_owner_name=fee.property.owner_name,
        fee_schedule_id=str(fee.fee_schedule.id),
        user_id=str(fee.user.id) if fee.user else None,
        amount=fee.amount,
        paid_amount=fee.paid_amount,
        remaining_amount=fee.amount - fee.paid_amount,
        generated_date=fee.generated_date,
        year=fee.year,
        month=fee.month,
        due_date=fee.due_date,
        status=fee.status,
        reference=fee.reference,
        notes=fee.notes
    )

@router.post("/", response_model=FeeResponse)
async def create_fee(
    fee_data: FeeCreate,
    current_user: User = Depends(get_current_user)
):
    # Get the property
    prop = await Property.get(fee_data.property_id)
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Check if user owns this property or is admin
    if (current_user.role != UserRole.ADMIN and
        (not prop.owner or str(prop.owner.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Get the fee schedule
    fee_schedule = await FeeSchedule.get(fee_data.fee_schedule_id)
    if not fee_schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee schedule not found"
        )

    # Use amount from fee schedule
    amount = fee_schedule.amount

    generated_date = datetime.utcnow()
    fee = Fee(
        property=prop,
        fee_schedule=fee_schedule,
        user=current_user if current_user.role == UserRole.OWNER else None,
        amount=amount,
        generated_date=generated_date,
        year=generated_date.year,
        month=generated_date.month,
        due_date=fee_data.due_date,
        reference=fee_data.reference,
        notes=fee_data.notes
    )
    await fee.insert()

    # Fetch linked documents for the response
    await fee.fetch_link(Fee.property)
    await fee.fetch_link(Fee.fee_schedule)
    if fee.user:
        await fee.fetch_link(Fee.user)

    return FeeResponse(
        id=str(fee.id),
        property_id=str(fee.property.id),
        property_villa=fee.property.villa,
        property_row_letter=fee.property.row_letter,
        property_number=fee.property.number,
        property_owner_name=fee.property.owner_name,
        fee_schedule_id=str(fee.fee_schedule.id),
        user_id=str(fee.user.id) if fee.user else None,
        amount=fee.amount,
        paid_amount=fee.paid_amount,
        remaining_amount=fee.amount - fee.paid_amount,
        generated_date=fee.generated_date,
        year=fee.year,
        month=fee.month,
        due_date=fee.due_date,
        status=fee.status,
        reference=fee.reference,
        notes=fee.notes
    )

@router.put("/{fee_id}", response_model=FeeResponse)
async def update_fee(
    fee_id: str,
    fee_update: FeeUpdate,
    current_user: User = Depends(get_current_user)
):
    fee = await Fee.get(fee_id)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )

    # Fetch linked documents
    await fee.fetch_link(Fee.property)
    await fee.fetch_link(Fee.fee_schedule)
    if fee.user:
        await fee.fetch_link(Fee.user)

    # Check permissions
    if (current_user.role != UserRole.ADMIN and
        (not fee.user or str(fee.user.id) != str(current_user.id))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # Prevent editing fees that are under agreement
    if fee.status == FeeStatus.AGREEMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit fees that are under agreement"
        )

    # Update fields (amount should not be updated as it's derived)
    update_data = fee_update.dict(exclude_unset=True)
    if 'amount' in update_data:
        del update_data['amount']  # Prevent updating amount
    for field, value in update_data.items():
        setattr(fee, field, value)

    await fee.save()

    # Fetch links again after save
    await fee.fetch_link(Fee.property)
    await fee.fetch_link(Fee.fee_schedule)
    if fee.user:
        await fee.fetch_link(Fee.user)

    return FeeResponse(
        id=str(fee.id),
        property_id=str(fee.property.id),
        property_villa=fee.property.villa,
        property_row_letter=fee.property.row_letter,
        property_number=fee.property.number,
        property_owner_name=fee.property.owner_name,
        fee_schedule_id=str(fee.fee_schedule.id),
        user_id=str(fee.user.id) if fee.user else None,
        amount=fee.amount,
        paid_amount=fee.paid_amount,
        remaining_amount=fee.amount - fee.paid_amount,
        generated_date=fee.generated_date,
        year=fee.year,
        month=fee.month,
        due_date=fee.due_date,
        status=fee.status,
        reference=fee.reference,
        notes=fee.notes
    )

@router.delete("/{fee_id}")
async def delete_fee(fee_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    fee = await Fee.get(fee_id)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )

    # Prevent deleting fees that are under agreement
    if fee.status == FeeStatus.AGREEMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete fees that are under agreement"
        )

    await fee.delete()
    return {"message": "Fee deleted successfully"}

@router.post("/generate")
async def generate_fees(request: GenerateFeesRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    now = datetime.utcnow()

    # Use provided year or default to current
    current_year = request.year if request.year else now.year

    # Handle months: use provided list or default to current month
    if request.months:
        months_to_generate = request.months
        # Validate month range
        for month in months_to_generate:
            if month < 1 or month > 12:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Month {month} must be between 1 and 12"
                )
    else:
        months_to_generate = [now.month]

    # Get fee schedules: use provided IDs or all active schedules
    if request.fee_schedule_ids:
        fee_schedules = []
        for schedule_id in request.fee_schedule_ids:
            schedule = await FeeSchedule.get(schedule_id)
            if not schedule:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Fee schedule {schedule_id} not found"
                )
            fee_schedules.append(schedule)
    else:
        # Default behavior: all active schedules
        if request.manual:
            # Manual generation: all active schedules
            fee_schedules = await FeeSchedule.find({"is_active": True}).to_list()
        else:
            # Automatic generation: only schedules with due_day matching today
            current_day = now.day
            fee_schedules = await FeeSchedule.find({
                "is_active": True,
                "due_day": current_day
            }).to_list()

    generated_count = 0

    for current_month in months_to_generate:
        for fee_schedule in fee_schedules:
            # Get all properties
            properties = await Property.find_all().to_list()

            for prop in properties:
                # Check if fee already exists for this property, fee_schedule, month, year
                existing_fee = await Fee.find_one(
                    Fee.property.id == prop.id,
                    Fee.fee_schedule.id == fee_schedule.id,
                    Fee.generated_date >= datetime(current_year, current_month, 1),
                    Fee.generated_date < datetime(current_year if current_month < 12 else current_year + 1, current_month % 12 + 1, 1)
                )

                if not existing_fee:
                    # Calculate due date: use the due_day from fee schedule
                    due_day = fee_schedule.due_day
                    try:
                        due_date = datetime(current_year, current_month, due_day)
                    except ValueError:
                        # Handle months with fewer days (e.g., February)
                        due_date = datetime(current_year, current_month + 1, 1) - timedelta(days=1)

                    # For past/future months, set generated_date to the specified month/year
                    if request.year or request.months:
                        generated_date = datetime(current_year, current_month, 1)  # Use first day of month
                    else:
                        generated_date = now

                    fee = Fee(
                        property=prop,
                        fee_schedule=fee_schedule,
                        amount=fee_schedule.amount,
                        generated_date=generated_date,
                        year=current_year,
                        month=current_month,
                        due_date=due_date,
                        reference=f"{'Manual' if request.manual else 'Auto'}-{current_year}-{current_month:02d}"
                    )
                    await fee.insert()
                    generated_count += 1

    return {"message": f"Generated {generated_count} fees"}