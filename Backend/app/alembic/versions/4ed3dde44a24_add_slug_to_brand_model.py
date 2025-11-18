"""Add slug to Brand model and backfill data

Revision ID: 4ed3dde44a24
Revises: 
Create Date: 2025-11-18 09:51:48.206090

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector
import re
import unicodedata

# revision identifiers, used by Alembic.
revision: str = '4ed3dde44a24'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def slugify(value: str) -> str:
    """
    Normalizes string, converts to lowercase, removes non-alpha characters,
    and converts spaces to hyphens.
    """
    if not isinstance(value, str):
        value = str(value)
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[-\s]+', '-', value)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'brands' not in tables:
        # This is a new database, create all tables from scratch
        op.create_table('brands',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('slug', sa.String(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_brands_id'), 'brands', ['id'], unique=False)
        op.create_index(op.f('ix_brands_name'), 'brands', ['name'], unique=True)
        op.create_index(op.f('ix_brands_slug'), 'brands', ['slug'], unique=True)
        
        op.create_table('ads',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('campaign_name', sa.String(), nullable=True),
            sa.Column('ad_date', sa.Date(), nullable=True),
            sa.Column('impressions', sa.Integer(), nullable=True),
            sa.Column('clicks', sa.Integer(), nullable=True),
            sa.Column('expense', sa.Float(), nullable=True),
            sa.Column('orders', sa.Integer(), nullable=True),
            sa.Column('gmv', sa.Float(), nullable=True),
            sa.Column('source', sa.String(), nullable=False),
            sa.Column('brand_id', sa.Integer(), nullable=True),
            sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_ad_brand_id_ad_date', 'ads', ['brand_id', 'ad_date'], unique=False)
        op.create_index(op.f('ix_ads_brand_id'), 'ads', ['brand_id'], unique=False)
        op.create_index(op.f('ix_ads_campaign_name'), 'ads', ['campaign_name'], unique=False)
        op.create_index(op.f('ix_ads_id'), 'ads', ['id'], unique=False)
        op.create_index(op.f('ix_ads_source'), 'ads', ['source'], unique=False)

        op.create_table('customers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('username', sa.String(), nullable=True),
            sa.Column('city', sa.String(), nullable=True),
            sa.Column('district', sa.String(), nullable=True),
            sa.Column('brand_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_customers_brand_id'), 'customers', ['brand_id'], unique=False)
        op.create_index(op.f('ix_customers_city'), 'customers', ['city'], unique=False)
        op.create_index(op.f('ix_customers_district'), 'customers', ['district'], unique=False)
        op.create_index(op.f('ix_customers_id'), 'customers', ['id'], unique=False)
        op.create_index(op.f('ix_customers_username'), 'customers', ['username'], unique=False)

        op.create_table('orders',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('order_code', sa.String(), nullable=True),
            sa.Column('order_date', sa.Date(), nullable=True),
            sa.Column('status', sa.String(), nullable=True),
            sa.Column('username', sa.String(), nullable=True),
            sa.Column('total_quantity', sa.Integer(), nullable=True),
            sa.Column('cogs', sa.Float(), nullable=True),
            sa.Column('source', sa.String(), nullable=False),
            sa.Column('brand_id', sa.Integer(), nullable=True),
            sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('order_code', 'brand_id', name='uq_order_brand_code')
        )
        op.create_index('ix_order_brand_id_order_date', 'orders', ['brand_id', 'order_date'], unique=False)
        op.create_index(op.f('ix_orders_brand_id'), 'orders', ['brand_id'], unique=False)
        op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)
        op.create_index(op.f('ix_orders_order_code'), 'orders', ['order_code'], unique=False)
        op.create_index(op.f('ix_orders_source'), 'orders', ['source'], unique=False)
        op.create_index(op.f('ix_orders_status'), 'orders', ['status'], unique=False)
        op.create_index(op.f('ix_orders_username'), 'orders', ['username'], unique=False)

        op.create_table('products',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('sku', sa.String(), nullable=True),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('cost_price', sa.Integer(), nullable=True),
            sa.Column('brand_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_products_brand_id'), 'products', ['brand_id'], unique=False)
        op.create_index(op.f('ix_products_cost_price'), 'products', ['cost_price'], unique=False)
        op.create_index(op.f('ix_products_id'), 'products', ['id'], unique=False)
        op.create_index(op.f('ix_products_name'), 'products', ['name'], unique=False)
        op.create_index(op.f('ix_products_sku'), 'products', ['sku'], unique=False)

        op.create_table('revenues',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('order_code', sa.String(), nullable=True),
            sa.Column('transaction_date', sa.Date(), nullable=True),
            sa.Column('net_revenue', sa.Float(), nullable=True),
            sa.Column('gmv', sa.Float(), nullable=True),
            sa.Column('total_fees', sa.Float(), nullable=True),
            sa.Column('refund', sa.Float(), nullable=True),
            sa.Column('source', sa.String(), nullable=False),
            sa.Column('brand_id', sa.Integer(), nullable=True),
            sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_revenue_brand_id_transaction_date', 'revenues', ['brand_id', 'transaction_date'], unique=False)
        op.create_index(op.f('ix_revenues_brand_id'), 'revenues', ['brand_id'], unique=False)
        op.create_index(op.f('ix_revenues_id'), 'revenues', ['id'], unique=False)
        op.create_index(op.f('ix_revenues_order_code'), 'revenues', ['order_code'], unique=False)
        op.create_index(op.f('ix_revenues_source'), 'revenues', ['source'], unique=False)

    else:
        # The 'brands' table exists, check if 'slug' column is missing
        columns = [c['name'] for c in inspector.get_columns('brands')]
        if 'slug' not in columns:
            op.add_column('brands', sa.Column('slug', sa.String(), nullable=True))
            op.create_index(op.f('ix_brands_slug'), 'brands', ['slug'], unique=True)

    # --- Backfill slugs for existing brands ---
    bind = op.get_bind()
    Session = sa.orm.sessionmaker(bind=bind)
    session = Session()

    try:
        # Define a simple Brand table for the purpose of the migration
        brand_table = sa.Table('brands', sa.MetaData(),
                               sa.Column('id', sa.Integer, primary_key=True),
                               sa.Column('name', sa.String),
                               sa.Column('slug', sa.String))

        brands = session.query(brand_table).filter(brand_table.c.slug.is_(None)).all()
        
        for brand in brands:
            if brand.name:
                base_slug = slugify(brand.name)
                unique_slug = base_slug
                counter = 1
                # Ensure slug is unique
                while session.query(brand_table).filter(brand_table.c.slug == unique_slug).first():
                    unique_slug = f"{base_slug}-{counter}"
                    counter += 1
                
                session.execute(
                    brand_table.update().where(brand_table.c.id == brand.id).values(slug=unique_slug)
                )
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error during slug backfill: {e}")
    finally:
        session.close()


def downgrade() -> None:
    # This is a simplified downgrade, in a real scenario you might need more logic
    op.drop_index(op.f('ix_brands_slug'), table_name='brands')
    op.drop_column('brands', 'slug')
    # The rest of the downgrade path is complex if we conditionally created tables.
    # For this project, we'll assume we don't need to downgrade the initial schema.
    # If you need to, you would add checks here similar to the upgrade function.


    # ### end Alembic commands ###
