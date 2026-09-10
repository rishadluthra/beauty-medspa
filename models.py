from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class Patient(BaseModel):
    """
    Represents a patient in the system.

    Patients can have multiple appointments and payments associated with them.
    The patient_id field is used as a foreign key in other models.
    """

    id: str  # Unique identifier for the patient
    first_name: str
    last_name: str
    date_of_birth: datetime
    gender: Literal["male", "female", "other"]
    address: str
    phone: str
    email: str
    source: Literal[
        "in_person", "phone", "instagram", "tiktok", "google", "website"
    ]  # How the patient found the practice
    created_date: datetime  # When the patient record was created


class Payment(BaseModel):
    """
    Represents a payment transaction for a appointment.

    Payments are linked to appointments, patients, providers, and services.
    Note: Not all appointments have payments - some appointments may be unpaid.

    Important:
    - amount is stored in cents (e.g., $100.50 = 10050 cents)
    - status indicates whether the payment was successful, pending, or failed
    - method indicates how the payment was made (card payments are most common)
    - The service_id refers to the primary service for the appointment
    """

    id: str  # Unique identifier for the payment
    patient_id: str  # Foreign key to Patient
    amount: int  # Amount in cents (e.g., $100.50 = 10050)
    date: datetime  # When the payment was processed/attempted
    method: Literal["cash", "credit_card", "debit_card", "check"]
    status: Literal["pending", "paid", "failed"]
    provider_id: str  # Foreign key to Provider
    appointment_id: str  # Foreign key to Appointment
    service_id: str  # Foreign key to Service (primary service for the appointment)
    created_date: datetime  # When the payment record was created


class Provider(BaseModel):
    """
    Represents a provider (doctor, nurse, specialist, etc.).

    Providers can be associated with multiple appointments and services.
    The provider_id field is used as a foreign key in other models.
    """

    id: str  # Unique identifier for the provider
    first_name: str
    last_name: str
    email: str
    phone: str
    created_date: datetime  # When the provider record was created


class Appointment(BaseModel):
    """
    Represents a appointment.

    An appointment links a patient to multiple services through AppointmentService.
    Each service in an appointment can have its own provider - see AppointmentService
    for the full list of services and providers associated with an appointment.

    Relationships:
    - Each appointment belongs to one patient (patient_id)
    - An appointment can have multiple AppointmentService entries (many-to-many)
    - Service and provider information is stored in AppointmentService, not here

    Status:
    - "pending": Appointment is scheduled but not yet confirmed
    - "confirmed": Appointment is confirmed and will proceed
    - "cancelled": Appointment has been cancelled
    """

    id: str  # Unique identifier for the appointment
    patient_id: str  # Foreign key to Patient
    status: Literal["pending", "confirmed", "cancelled"]  # Status of the appointment
    created_date: datetime  # When the appointment record was created


class AppointmentService(BaseModel):
    """
    Represents a many-to-many relationship between appointments and services.

    This model allows appointments to have multiple services, each with its own
    provider, start time, and end time. For example, an appointment might include
    a consultation, followed by a blood test, followed by an X-ray.

    Relationships:
    - Links an appointment (appointment_id) to a specific service (service_id)
    - Each service in an appointment can have a different provider (provider_id)
    - Tracks the scheduled time slot (start and end) for each service
    """

    appointment_id: str  # Foreign key to Appointment
    service_id: str  # Foreign key to Service
    provider_id: str  # Foreign key to Provider
    start: datetime  # Scheduled start time for this service
    end: datetime  # Scheduled end time for this service


class Service(BaseModel):
    """
    Represents a service that can be provided.

    Services are the billable items in the system. Examples include consultations,
    tests, procedures, etc. Services are linked to appointments through the
    AppointmentService model.

    Important:
    - price is stored in cents (e.g., $150.00 = 15000 cents)
    - duration is in minutes
    """

    id: str  # Unique identifier for the service
    name: str  # Name of the service (e.g., "General Consultation", "Blood Test")
    description: str  # Description of what the service entails
    price: int  # Price in cents (e.g., $150.00 = 15000)
    duration: int  # Duration in minutes
    created_date: datetime  # When the service record was created
