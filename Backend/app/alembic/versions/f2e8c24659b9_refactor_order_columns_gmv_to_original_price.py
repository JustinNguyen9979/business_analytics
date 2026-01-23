"""refactor_order_columns_gmv_to_original_price

Revision ID: f2e8c24659b9
Revises: f1e7b13548a8
Create Date: 2026-01-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f2e8c24659b9'
down_revision = 'e6eff32852da'
branch_labels = None
depends_on = None

def upgrade():
    # 1. Rename column gmv -> original_price
    op.alter_column('orders', 'gmv', new_column_name='original_price')
    
    # 2. Add column sku_price
    op.add_column('orders', sa.Column('sku_price', sa.Float(), nullable=True, default=0.0))
    
    # 3. Drop column selling_price
    op.drop_column('orders', 'selling_price')


def downgrade():
    # Revert changes
    op.add_column('orders', sa.Column('selling_price', sa.Float(), nullable=True))
    op.drop_column('orders', 'sku_price')
    op.alter_column('orders', 'original_price', new_column_name='gmv')
