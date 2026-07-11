from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from .database import Base

class Build(Base):
    __tablename__ = "builds"

    id = Column(Integer, primary_key=True, index=True)
    job_name = Column(String, nullable=False, index=True)
    build_number = Column(Integer, nullable=False, index=True)
    status = Column(String, nullable=False)
    started_at = Column(DateTime, nullable=False)
    duration_seconds = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("job_name", "build_number", name="uq_job_build"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "job_name": self.job_name,
            "build_number": self.build_number,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "duration_seconds": self.duration_seconds
        }
