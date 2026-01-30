"""add_pg_trgm_and_gin_index

Revision ID: a2b3c4d5e6f7
Revises: 22dabc5cc5ac
Create Date: 2026-01-30 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '22dabc5cc5ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Enable the extension first
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    # 2. Create the index using gin_trgm_ops
    op.create_index('idx_customer_search_gin', 'customers', ['username', 'phone', 'email'], unique=False, postgresql_using='gin', postgresql_ops={'username': 'gin_trgm_ops', 'phone': 'gin_trgm_ops', 'email': 'gin_trgm_ops'})

def downgrade() -> None:
    op.drop_index('idx_customer_search_gin', table_name='customers')
    # Optional: usually extensions are kept, but strictly speaking downgrade should remove it
    # op.execute("DROP EXTENSION IF EXISTS pg_trgm;")
