from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from ..models.fee import FeeSchedule, FeeScheduleCreate, FeeScheduleUpdate, FeeScheduleResponse
from ..models.user import User, UserRole
from ..routes.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[FeeScheduleResponse])
async def get_fee_schedules(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    schedules = await FeeSchedule.find_all().to_list()
    return [
        FeeScheduleResponse(
            id=str(schedule.id),
            amount=schedule.amount,
            description=schedule.description,
            effective_date=schedule.effective_date,
            end_date=schedule.end_date,
            is_active=schedule.is_active,
            due_day=schedule.due_day
        )
        for schedule in schedules
    ]

@router.get("/{schedule_id}", response_model=FeeScheduleResponse)
async def get_fee_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    schedule = await FeeSchedule.get(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee schedule not found"
        )

    return FeeScheduleResponse(
        id=str(schedule.id),
        amount=schedule.amount,
        description=schedule.description,
        effective_date=schedule.effective_date,
        end_date=schedule.end_date,
        is_active=schedule.is_active,
        due_day=schedule.due_day
    )

@router.post("/", response_model=FeeScheduleResponse)
async def create_fee_schedule(
    schedule_data: FeeScheduleCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    schedule = FeeSchedule(
        amount=schedule_data.amount,
        description=schedule_data.description,
        effective_date=schedule_data.effective_date,
        end_date=schedule_data.end_date,
        due_day=schedule_data.due_day
    )
    await schedule.insert()

    return FeeScheduleResponse(
        id=str(schedule.id),
        amount=schedule.amount,
        description=schedule.description,
        effective_date=schedule.effective_date,
        end_date=schedule.end_date,
        is_active=schedule.is_active,
        due_day=schedule.due_day
    )

@router.put("/{schedule_id}", response_model=FeeScheduleResponse)
async def update_fee_schedule(
    schedule_id: str,
    schedule_update: FeeScheduleUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    schedule = await FeeSchedule.get(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee schedule not found"
        )

    update_data = schedule_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)

    await schedule.save()

    return FeeScheduleResponse(
        id=str(schedule.id),
        amount=schedule.amount,
        description=schedule.description,
        effective_date=schedule.effective_date,
        end_date=schedule.end_date,
        is_active=schedule.is_active,
        due_day=schedule.due_day
    )

@router.delete("/{schedule_id}")
async def delete_fee_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    schedule = await FeeSchedule.get(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee schedule not found"
        )
    await schedule.delete()
    return {"message": "Fee schedule deleted successfully"}