"""custom field and policy product category

Revision ID: d4f8b2c61a97
Revises: b7f3c9a2d41e
Create Date: 2026-11-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f8b2c61a97'
down_revision: Union[str, None] = 'b7f3c9a2d41e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'custom_fields',
        sa.Column('product_category', sa.String(length=100), nullable=True),
    )
    op.add_column(
        'policies',
        sa.Column('product_category', sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('policies', 'product_category')
    op.drop_column('custom_fields', 'product_category')
