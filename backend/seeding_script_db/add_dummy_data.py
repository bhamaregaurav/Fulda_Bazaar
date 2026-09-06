import asyncio
from datetime import date, timedelta
from random import choice, randint
from passlib.context import CryptContext

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from faker import Faker

from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user_models import User
from app.models.permission_model import Permission
from app.models.listing_model import Category, Listing, ListingImage
from app.models.watchlist_model import Watchlist

fake = Faker()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def insert_dummy_data():
    async with AsyncSessionLocal() as db:  # type: AsyncSession

        # 1️⃣ Seed permissions table FIRST
        result = await db.execute(select(Permission))
        if not result.scalars().first():
            perms = [
                Permission(
                    role_name="Admin",
                    can_manage_users=True,
                    can_moderate_content=True,
                    can_access_reports=True,
                    can_view_logs=True,
                    can_post_listing=True,
                    can_send_messages=True,
                    can_manage_platform=True,
                ),
                Permission(
                    role_name="Moderator",
                    can_manage_users=False,
                    can_moderate_content=True,
                    can_access_reports=True,
                    can_view_logs=True,
                    can_post_listing=True,
                    can_send_messages=True,
                    can_manage_platform=False,
                ),
                Permission(
                    role_name="User",
                    can_manage_users=False,
                    can_moderate_content=False,
                    can_access_reports=False,
                    can_view_logs=False,
                    can_post_listing=True,
                    can_send_messages=True,
                    can_manage_platform=False,
                ),
            ]
            db.add_all(perms)
            await db.commit()

        # Fetch permissions for reference
        permissions = {}
        result = await db.execute(select(Permission))
        for perm in result.scalars():
            permissions[perm.role_name] = perm

        # 2️⃣ Seed expanded categories if not present
        category_seed_data = [
            {"name": "Electronics", "is_active": True},
            {"name": "Books", "is_active": True},
            {"name": "Furniture", "is_active": True},
            {"name": "Clothing", "is_active": True},
            {"name": "Sports & Fitness", "is_active": True},
            {"name": "Kitchen & Appliances", "is_active": True},
            {"name": "Bicycles", "is_active": True},
            {"name": "Stationery", "is_active": True},
            {"name": "Tickets & Events", "is_active": True},
            {"name": "Services", "is_active": True},
            {"name": "Tutoring", "is_active": True},
            {"name": "Subscriptions", "is_active": True},
            {"name": "Games & Entertainment", "is_active": True},
            {"name": "Housing & Accommodation", "is_active": True},
            {"name": "Other", "is_active": True},
        ]
        result = await db.execute(select(Category))
        categories = result.scalars().all()
        if not categories:
            category_objs = [Category(**cat) for cat in category_seed_data]
            db.add_all(category_objs)
            await db.commit()

        # Fetch categories for reference (dict by name)
        category_objs = {}
        result = await db.execute(select(Category))
        for cat in result.scalars():
            category_objs[cat.name] = cat

        # 3️⃣ Seed users (linked to permissions) WITH HASHED PASSWORDS
        users_data = [
            {
                "email": "admin@hs-fulda.de",
                "first_name": "Admin",
                "last_name": "User",
                "plain_password": "Admin@123",
                "permission": permissions["Admin"],
            },
            {
                "email": "sarah.student@hs-fulda.de",
                "first_name": "Sarah",
                "last_name": "Student",
                "plain_password": "Student@123",
                "permission": permissions["Moderator"],
            },
            {
                "email": "miguel.int@hs-fulda.de",
                "first_name": "Miguel",
                "last_name": "International",
                "plain_password": "Miguel@123",
                "permission": permissions["User"],
            },
        ]
        user_objs = []
        for user_data in users_data:
            result = await db.execute(select(User).filter_by(email=user_data["email"]))
            user = result.scalars().first()
            if not user:
                user = User(
                    email=user_data["email"],
                    password=pwd_context.hash(user_data["plain_password"]),
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    phone_number = fake.msisdn()[:20],
                    profile_picture=None,
                    bio=fake.sentence(nb_words=6),
                    registration_date=date.today(),
                    last_login=date.today(),
                    account_status="Active",
                    verification_status=True,
                    trust_score=round(randint(30, 50) / 10.0, 2),
                    two_fa=False,
                    listings_count=0,
                    permission_id=user_data["permission"].permission_id,
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
            user_objs.append(user)

        # 4️⃣ Diverse listings for users (linked to categories and created_by)
        listing_seed_data = [
            # Electronics
            {
                "title": "iPhone 12",
                "description": "Lightly used iPhone 12",
                "category": "Electronics",
                "price": 499.99,
                "image": "https://images/iphone12.jpg"
            },
            {
                "title": "HP Laptop",
                "description": "Perfect for students, 8GB RAM, SSD.",
                "category": "Electronics",
                "price": 350.00,
                "image": "https://images/laptop.jpg"
            },
            # Books
            {
                "title": "Python Programming Book",
                "description": "Beginner-friendly Python book",
                "category": "Books",
                "price": 20.00,
                "image": "https://images/python_book.jpg"
            },
            {
                "title": "Data Structures Textbook",
                "description": "Essential for CS students.",
                "category": "Books",
                "price": 15.00,
                "image": "https://images/datastructures_book.jpg"
            },
            # Furniture
            {
                "title": "Bookshelf",
                "description": "Wooden bookshelf in great condition",
                "category": "Furniture",
                "price": 40.00,
                "image": "https://images/bookshelf.jpg"
            },
            {
                "title": "Office Chair",
                "description": "Ergonomic and comfy for long study sessions.",
                "category": "Furniture",
                "price": 30.00,
                "image": "https://images/office_chair.jpg"
            },
            # Clothing
            {
                "title": "Winter Jacket",
                "description": "Warm, barely worn, size M.",
                "category": "Clothing",
                "price": 25.00,
                "image": "https://images/winter_jacket.jpg"
            },
            # Sports & Fitness
            {
                "title": "Yoga Mat",
                "description": "Non-slip yoga mat, barely used.",
                "category": "Sports & Fitness",
                "price": 10.00,
                "image": "https://images/yoga_mat.jpg"
            },
            {
                "title": "4-Month Gym Subscription",
                "description": "Transferable gym membership.",
                "category": "Subscriptions",
                "price": 45.00,
                "image": "https://images/gym.jpg"
            },
            # Bicycles
            {
                "title": "Mountain Bike",
                "description": "Used for one semester, great condition.",
                "category": "Bicycles",
                "price": 100.00,
                "image": "https://images/bike.jpg"
            },
            # Kitchen & Appliances
            {
                "title": "Microwave Oven",
                "description": "Works perfectly, only 1 year old.",
                "category": "Kitchen & Appliances",
                "price": 25.00,
                "image": "https://images/microwave.jpg"
            },
            # Stationery
            {
                "title": "Pack of Markers",
                "description": "Full set, barely used.",
                "category": "Stationery",
                "price": 5.00,
                "image": "https://images/markers.jpg"
            },
            # Services
            {
                "title": "Math Tutoring",
                "description": "Help with calculus and statistics.",
                "category": "Tutoring",
                "price": 0.00,
                "image": "https://images/tutoring.jpg"
            },
            # Housing & Accommodation
            {
                "title": "Room for Rent - Summer",
                "description": "Fully furnished, close to campus.",
                "category": "Housing & Accommodation",
                "price": 300.00,
                "image": "https://images/room.jpg"
            },
            # Games & Entertainment
            {
                "title": "Board Games",
                "description": "Various games, fun for group nights.",
                "category": "Games & Entertainment",
                "price": 10.00,
                "image": "https://images/board_games.jpg"
            },
            # Other
            {
                "title": "Random Mystery Box",
                "description": "A box with random useful items for students.",
                "category": "Other",
                "price": 8.00,
                "image": "https://images/mystery_box.jpg"
            },
        ]

        # Only add listings if table is empty
        result = await db.execute(select(Listing))
        existing = result.scalars().first()
        if not existing:
            for user in user_objs:
                for _ in range(randint(2, 5)):  # More listings per user
                    item = choice(listing_seed_data)
                    # Choose a valid listing type based on price and item
                    # Valid types are: 'Sell', 'Buy', 'Exchange', 'Borrow/Lend', 'Free'
                    if item["price"] > 0:
                        listing_type = "Sell"
                    else:
                        listing_type = "Free"  # Changed from "Offer" to "Free"
                    
                    listing = Listing(
                        title=item["title"],
                        description=item["description"],
                        category_id=category_objs[item["category"]].category_id,
                        subcategory_id=None,
                        listing_type=listing_type,
                        price=item["price"],
                        negotiable=bool(randint(0, 1)),
                        condition=choice(["New", "Like New", "Good"]),
                        location="Fulda",
                        geo_coordinates=from_shape(Point(9.669, 50.554), srid=4326),
                        status="Review",  # Changed from "Active" to "Review" to implement the new workflow
                        created_by=user.user_id,
                        created_at=date.today(),
                        expiration_date=date.today() + timedelta(days=30),
                        view_count=0,
                        is_featured=False,
                        exchange_preferences=None,
                        borrow_duration=None
                    )
                    db.add(listing)
                    await db.commit()
                    await db.refresh(listing)

                    image = ListingImage(
                        listing_id=listing.listing_id,
                        image_path=item["image"],
                        is_primary=True,
                        display_order=1
                    )
                    db.add(image)
                    await db.commit()

        print("✅ Dummy permissions, categories, users, listings, and images inserted.")
        print("Login with these users:")
        print("  admin@hs-fulda.de / Admin@123")
        print("  sarah.student@hs-fulda.de / Student@123")
        print("  miguel.int@hs-fulda.de / Miguel@123")

async def main():
    await create_tables()
    await insert_dummy_data()

if __name__ == "__main__":
    asyncio.run(main())