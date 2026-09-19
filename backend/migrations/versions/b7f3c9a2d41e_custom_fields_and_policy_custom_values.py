"""custom fields and policy custom values

Revision ID: b7f3c9a2d41e
Revises: 4976fcd78bbc
Create Date: 2026-09-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f3c9a2d41e'
down_revision: Union[str, None] = '4976fcd78bbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'custom_fields',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=False),
        sa.Column('insurance_type', sa.String(length=50), nullable=True),
        sa.Column('field_type', sa.String(length=20), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('policies', sa.Column('custom_values', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('policies', 'custom_values')
    op.drop_table('custom_fields')